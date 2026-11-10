import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { children, families, taskAssignees, taskDays, tasks, TASK_MODES } from "../db/schema";
import type { Db, DbOrTx, Tx } from "../db/types";
import { addDays, dateInZone, formatDate, weekdayIndex } from "@/lib/time";
import { DomainError, invalid, notFound } from "./errors";
import { recordTransaction, type Transaction } from "./ledger";
import { notifyRejected } from "./notifications";
import { validatePoints } from "./rules";

// Nhiệm vụ hằng ngày (spec daily-tasks, design D3).
// - Mọi thay đổi (tạo, sửa, tạm dừng) có hiệu lực từ ngày hôm sau theo múi giờ gia đình.
// - Sửa nhiệm vụ tạo một phiên bản mới (effective_from = ngày mai), bản cũ dừng từ ngày mai và trỏ
//   sang bản mới qua replaced_by_task_id; nhờ vậy hôm nay và các ngày đã qua không đổi.
// - task_days được tạo lười khi con báo xong hoặc bố mẹ đánh dấu.

export type Task = typeof tasks.$inferSelect;
export type TaskMode = (typeof TASK_MODES)[number];
export type TaskDayStatus = "todo" | "pending" | "done";

export const REVIEW_WINDOW_DAYS = 7;
export const ALL_WEEKDAYS_MASK = 127;

// ---------------------------------------------------------------- ngày của gia đình

async function familyTz(db: DbOrTx, familyId: number): Promise<string> {
  const [f] = await db.select({ tz: families.timezone }).from(families).where(eq(families.id, familyId));
  if (!f) throw notFound();
  return f.tz;
}

/** Ngày hôm nay (YYYY-MM-DD) theo múi giờ gia đình (design D5). */
export function familyToday(family: { timezone: string }, now: Date): string {
  return dateInZone(now, family.timezone);
}

export function maskFromWeekdays(days: number[]): number {
  let mask = 0;
  for (const d of days) {
    if (!Number.isInteger(d) || d < 0 || d > 6) throw invalid("Ngày trong tuần không hợp lệ");
    mask |= 1 << d;
  }
  if (mask === 0) throw invalid("Chọn ít nhất một ngày trong tuần");
  return mask;
}

export function weekdaysFromMask(mask: number): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => (mask & (1 << d)) !== 0);
}

// ---------------------------------------------------------------- danh sách nhiệm vụ của một ngày

type Kid = { id: number; name: string; createdAt: Date };

export type DayItem = {
  key: string;
  taskId: number;
  name: string;
  points: number;
  mode: TaskMode;
  date: string;
  /** Nhiệm vụ riêng: con được giao; nhiệm vụ nhóm: null. */
  childId: number | null;
  /** Các con được giao trong ngày (nhóm: cả nhóm; riêng: chỉ một con). */
  members: { id: number; name: string }[];
  status: TaskDayStatus;
  reportedByChildId: number | null;
  rejectReason: string | null;
};

/** Các con được giao một nhiệm vụ trong ngày `date` (design D3 "Con được giao trong một ngày"). */
function membersOn(task: Task, date: string, kids: Kid[], assignees: (typeof taskAssignees.$inferSelect)[], tz: string): Kid[] {
  if (task.assignAll) {
    // "Tất cả các con": con mới được giao từ ngày hôm sau ngày tạo hồ sơ.
    return kids.filter((k) => dateInZone(k.createdAt, tz) < date);
  }
  const ids = new Set(
    assignees.filter((a) => a.taskId === task.id && a.effectiveFrom <= date && (a.removedFrom === null || date < a.removedFrom)).map((a) => a.childId),
  );
  return kids.filter((k) => ids.has(k.id));
}

/**
 * Danh sách nhiệm vụ của gia đình trong một ngày: nhiệm vụ còn hiệu lực, đúng ngày trong tuần, chưa
 * tạm dừng, với các con chưa lưu trữ vào ngày đó; ghép với trạng thái đã lưu trong task_days.
 */
export async function getDay(db: DbOrTx, familyId: number, date: string): Promise<DayItem[]> {
  const tz = await familyTz(db, familyId);
  const bit = 1 << weekdayIndex(date);
  const active = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.familyId, familyId),
        lte(tasks.effectiveFrom, date),
        sql`(${tasks.pausedFrom} is null or ${tasks.pausedFrom} > ${date})`,
        sql`(${tasks.weekdaysMask} & ${bit}) <> 0`,
      ),
    )
    .orderBy(asc(tasks.id));
  if (active.length === 0) return [];

  const allKids = await db
    .select({ id: children.id, name: children.name, createdAt: children.createdAt, archivedAt: children.archivedAt })
    .from(children)
    .where(eq(children.familyId, familyId))
    .orderBy(asc(children.id));
  // Con đã lưu trữ vẫn thuộc những ngày trước ngày lưu trữ, để trạng thái các ngày đó được giữ
  // (spec daily-tasks "Con đã lưu trữ"). Từ ngày lưu trữ trở đi con không còn được giao.
  const kids = allKids.filter((k) => k.archivedAt === null || date < dateInZone(k.archivedAt, tz));
  const ids = active.map((t) => t.id);
  const [assignees, days] = await Promise.all([
    db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids)),
    db.select().from(taskDays).where(and(inArray(taskDays.taskId, ids), eq(taskDays.date, date))),
  ]);
  // Ngày lưu trữ: mục riêng con đã báo xong hoặc đã được duyệt trước lúc lưu trữ vẫn hiện, để bố mẹ
  // duyệt được việc con đã làm.
  const archivedToday = allKids.filter((k) => k.archivedAt !== null && date === dateInZone(k.archivedAt, tz));

  const items: DayItem[] = [];
  for (const task of active) {
    const members = membersOn(task, date, kids, assignees, tz);
    if (task.mode === "individual") {
      for (const k of membersOn(task, date, archivedToday, assignees, tz)) {
        if (days.some((d) => d.taskId === task.id && d.childId === k.id && d.status !== "todo")) members.push(k);
      }
    }
    if (members.length === 0) continue;
    const base = { taskId: task.id, name: task.name, points: task.points, mode: task.mode, date };
    if (task.mode === "group") {
      const row = days.find((d) => d.taskId === task.id && d.childId === null);
      items.push({
        ...base,
        key: `${task.id}-g`,
        childId: null,
        members: members.map((m) => ({ id: m.id, name: m.name })),
        status: row?.status ?? "todo",
        reportedByChildId: row?.reportedByChildId ?? null,
        rejectReason: row?.status === "todo" ? (row?.rejectReason ?? null) : null,
      });
    } else {
      for (const m of members) {
        const row = days.find((d) => d.taskId === task.id && d.childId === m.id);
        items.push({
          ...base,
          key: `${task.id}-${m.id}`,
          childId: m.id,
          members: [{ id: m.id, name: m.name }],
          status: row?.status ?? "todo",
          reportedByChildId: row?.reportedByChildId ?? null,
          rejectReason: row?.status === "todo" ? (row?.rejectReason ?? null) : null,
        });
      }
    }
  }
  return items;
}

/** Nhiệm vụ của một con trong ngày (riêng của con, và nhóm có con là thành viên). */
export async function getChildDay(db: DbOrTx, familyId: number, childId: number, date: string): Promise<DayItem[]> {
  return (await getDay(db, familyId, date)).filter((i) => (i.mode === "individual" ? i.childId === childId : i.members.some((m) => m.id === childId)));
}

/** Nhiệm vụ hôm nay của một con. */
export async function getChildToday(db: DbOrTx, familyId: number, childId: number, clock: Clock = systemClock) {
  const today = dateInZone(clock.now(), await familyTz(db, familyId));
  return { date: today, items: await getChildDay(db, familyId, childId, today) };
}

/** Các mục chờ duyệt trong 7 ngày gần nhất (hàng chờ duyệt chung). */
export async function listPendingTaskDays(db: DbOrTx, familyId: number, clock: Clock = systemClock): Promise<DayItem[]> {
  const today = dateInZone(clock.now(), await familyTz(db, familyId));
  const from = addDays(today, -REVIEW_WINDOW_DAYS);
  const pending = await db
    .selectDistinct({ date: taskDays.date })
    .from(taskDays)
    .innerJoin(tasks, eq(tasks.id, taskDays.taskId))
    .where(and(eq(tasks.familyId, familyId), eq(taskDays.status, "pending"), gte(taskDays.date, from), lte(taskDays.date, today)));
  const result: DayItem[] = [];
  for (const { date } of pending.sort((a, b) => a.date.localeCompare(b.date))) {
    result.push(...(await getDay(db, familyId, date)).filter((i) => i.status === "pending"));
  }
  return result;
}

// ---------------------------------------------------------------- tạo, sửa, tạm dừng (bố mẹ)

export type TaskInput = {
  name: string;
  points: number;
  weekdays: number[];
  mode: string;
  assignAll: boolean;
  childIds: number[];
};

async function validateTaskInput(db: DbOrTx, familyId: number, input: TaskInput) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if ([...name].length < 1 || [...name].length > 60) throw invalid("Tên nhiệm vụ phải dài từ 1 đến 60 ký tự");
  const points = validatePoints(input.points);
  const weekdaysMask = maskFromWeekdays(input.weekdays);
  if (!(TASK_MODES as readonly string[]).includes(input.mode)) throw invalid("Kiểu nhiệm vụ không hợp lệ");
  let childIds: number[] = [];
  if (!input.assignAll) {
    childIds = [...new Set(input.childIds)];
    if (childIds.length === 0) throw invalid("Chọn ít nhất một con");
    const found = await db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.familyId, familyId), isNull(children.archivedAt), inArray(children.id, childIds)));
    if (found.length !== childIds.length) throw notFound("Không tìm thấy con được chọn");
  }
  // Giao riêng cho đúng một con thì luôn là "mỗi con làm riêng".
  const mode: TaskMode = !input.assignAll && childIds.length === 1 ? "individual" : (input.mode as TaskMode);
  return { name, points, weekdaysMask, mode, assignAll: input.assignAll, childIds };
}

async function insertVersion(tx: Tx, familyId: number, v: Awaited<ReturnType<typeof validateTaskInput>>, effectiveFrom: string, pausedFrom: string | null) {
  const [task] = await tx
    .insert(tasks)
    .values({ familyId, name: v.name, points: v.points, mode: v.mode, assignAll: v.assignAll, weekdaysMask: v.weekdaysMask, effectiveFrom, pausedFrom })
    .returning();
  if (!v.assignAll) {
    await tx.insert(taskAssignees).values(v.childIds.map((childId) => ({ taskId: task.id, childId, effectiveFrom })));
  }
  return task;
}

async function tomorrowFor(db: DbOrTx, familyId: number, clock: Clock) {
  const today = dateInZone(clock.now(), await familyTz(db, familyId));
  return { today, tomorrow: addDays(today, 1) };
}

/** Tạo nhiệm vụ mới, có hiệu lực từ ngày mai. */
export async function createTask(db: Db, familyId: number, input: TaskInput, clock: Clock = systemClock): Promise<Task> {
  const v = await validateTaskInput(db, familyId, input);
  const { tomorrow } = await tomorrowFor(db, familyId, clock);
  return db.transaction((tx) => insertVersion(tx, familyId, v, tomorrow, null));
}

async function lockCurrent(tx: Tx, familyId: number, taskId: number): Promise<Task> {
  const [task] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.familyId, familyId), isNull(tasks.replacedByTaskId)))
    .for("update");
  if (!task) throw notFound();
  return task;
}

/** Sửa nhiệm vụ: từ ngày mai dùng phiên bản mới, hôm nay và các ngày trước không đổi. */
export async function updateTask(db: Db, familyId: number, taskId: number, input: TaskInput, clock: Clock = systemClock): Promise<Task> {
  const v = await validateTaskInput(db, familyId, input);
  const { tomorrow } = await tomorrowFor(db, familyId, clock);
  return db.transaction(async (tx) => {
    const old = await lockCurrent(tx, familyId, taskId);
    const paused = old.pausedFrom !== null && old.pausedFrom <= tomorrow;
    if (old.effectiveFrom >= tomorrow) {
      // Chưa bắt đầu: sửa tại chỗ.
      await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, old.id));
      const [task] = await tx
        .update(tasks)
        .set({ name: v.name, points: v.points, mode: v.mode, assignAll: v.assignAll, weekdaysMask: v.weekdaysMask })
        .where(eq(tasks.id, old.id))
        .returning();
      if (!v.assignAll) await tx.insert(taskAssignees).values(v.childIds.map((childId) => ({ taskId: old.id, childId, effectiveFrom: old.effectiveFrom })));
      return task;
    }
    const next = await insertVersion(tx, familyId, v, tomorrow, paused ? tomorrow : null);
    await tx.update(tasks).set({ pausedFrom: old.pausedFrom ?? tomorrow, replacedByTaskId: next.id }).where(eq(tasks.id, old.id));
    return next;
  });
}

/** Tạm dừng: từ ngày mai nhiệm vụ không còn xuất hiện; các ngày trước giữ nguyên trạng thái. */
export async function pauseTask(db: Db, familyId: number, taskId: number, clock: Clock = systemClock): Promise<void> {
  const { tomorrow } = await tomorrowFor(db, familyId, clock);
  await db.transaction(async (tx) => {
    const task = await lockCurrent(tx, familyId, taskId);
    if (task.pausedFrom !== null) throw new DomainError("CONFLICT", "Nhiệm vụ đã tạm dừng");
    await tx
      .update(tasks)
      .set({ pausedFrom: task.effectiveFrom > tomorrow ? task.effectiveFrom : tomorrow })
      .where(eq(tasks.id, task.id));
  });
}

/** Chạy lại nhiệm vụ đã tạm dừng, từ ngày mai. */
export async function resumeTask(db: Db, familyId: number, taskId: number, clock: Clock = systemClock): Promise<Task> {
  const { today, tomorrow } = await tomorrowFor(db, familyId, clock);
  return db.transaction(async (tx) => {
    const old = await lockCurrent(tx, familyId, taskId);
    if (old.pausedFrom === null) throw new DomainError("CONFLICT", "Nhiệm vụ đang chạy");
    if (old.pausedFrom > today) {
      // Lệnh tạm dừng chưa có hiệu lực: bỏ lệnh.
      const [task] = await tx.update(tasks).set({ pausedFrom: null }).where(eq(tasks.id, old.id)).returning();
      return task;
    }
    const assignees = old.assignAll ? [] : await tx.select().from(taskAssignees).where(and(eq(taskAssignees.taskId, old.id), isNull(taskAssignees.removedFrom)));
    const [next] = await tx
      .insert(tasks)
      .values({ familyId, name: old.name, points: old.points, mode: old.mode, assignAll: old.assignAll, weekdaysMask: old.weekdaysMask, effectiveFrom: tomorrow })
      .returning();
    if (assignees.length) await tx.insert(taskAssignees).values(assignees.map((a) => ({ taskId: next.id, childId: a.childId, effectiveFrom: tomorrow })));
    await tx.update(tasks).set({ replacedByTaskId: next.id }).where(eq(tasks.id, old.id));
    return next;
  });
}

export type TaskSummary = Task & { assignees: { id: number; name: string }[]; state: "active" | "scheduled" | "paused" };

/** Bảng nhiệm vụ đang có (phiên bản hiện tại của mỗi nhiệm vụ). */
export async function listTasks(db: DbOrTx, familyId: number, clock: Clock = systemClock): Promise<TaskSummary[]> {
  const today = dateInZone(clock.now(), await familyTz(db, familyId));
  const current = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.familyId, familyId), isNull(tasks.replacedByTaskId)))
    .orderBy(asc(tasks.id));
  if (current.length === 0) return [];
  const rows = await db
    .select({ taskId: taskAssignees.taskId, id: children.id, name: children.name })
    .from(taskAssignees)
    .innerJoin(children, eq(children.id, taskAssignees.childId))
    .where(and(inArray(taskAssignees.taskId, current.map((t) => t.id)), isNull(taskAssignees.removedFrom), isNull(children.archivedAt)));
  return current.map((t) => ({
    ...t,
    assignees: rows.filter((r) => r.taskId === t.id).map((r) => ({ id: r.id, name: r.name })),
    state: t.pausedFrom !== null ? "paused" : t.effectiveFrom > today ? "scheduled" : "active",
  }));
}

// ---------------------------------------------------------------- con báo xong / hủy báo

async function findItem(db: DbOrTx, familyId: number, taskId: number, date: string, childId: number | null, opts: { asMember?: number } = {}) {
  const items = await getDay(db, familyId, date);
  const item = items.find(
    (i) =>
      i.taskId === taskId &&
      (i.mode === "group" ? (opts.asMember === undefined || i.members.some((m) => m.id === opts.asMember)) : i.childId === (childId ?? opts.asMember)),
  );
  if (!item) throw notFound("Không có nhiệm vụ này trong ngày");
  return item;
}

function rowTarget(item: DayItem) {
  return item.mode === "group"
    ? { target: [taskDays.taskId, taskDays.date], targetWhere: sql`${taskDays.childId} is null` }
    : { target: [taskDays.taskId, taskDays.childId, taskDays.date], targetWhere: sql`${taskDays.childId} is not null` };
}

const ALREADY_DONE = "Nhiệm vụ này đã hoàn thành";

/** Con báo xong nhiệm vụ của hôm nay: chuyển sang "chờ duyệt", không cộng điểm. Nhóm: báo cho cả nhóm. */
export async function reportDone(db: DbOrTx, kid: { familyId: number; childId: number }, taskId: number, clock: Clock = systemClock): Promise<DayItem> {
  const today = dateInZone(clock.now(), await familyTz(db, kid.familyId));
  const item = await findItem(db, kid.familyId, taskId, today, null, { asMember: kid.childId });
  if (item.status === "done") throw new DomainError("CONFLICT", ALREADY_DONE);
  const rows = await db
    .insert(taskDays)
    .values({ taskId, childId: item.childId, date: today, status: "pending", reportedByChildId: kid.childId, rejectReason: null })
    .onConflictDoUpdate({
      ...rowTarget(item),
      set: { status: "pending", reportedByChildId: kid.childId, rejectReason: null, updatedAt: clock.now() },
      setWhere: sql`${taskDays.status} = 'todo'`,
    })
    .returning({ id: taskDays.id });
  // Nhóm đã có người báo trước: giữ nguyên tên người báo đầu tiên.
  if (rows.length === 0 && item.status !== "pending") throw new DomainError("CONFLICT", ALREADY_DONE);
  return { ...item, status: "pending", reportedByChildId: item.status === "pending" ? item.reportedByChildId : kid.childId, rejectReason: null };
}

/** Con hủy báo khi bố mẹ chưa duyệt (nhóm: bất kỳ thành viên nào). */
export async function cancelReport(db: DbOrTx, kid: { familyId: number; childId: number }, taskId: number, clock: Clock = systemClock): Promise<void> {
  const today = dateInZone(clock.now(), await familyTz(db, kid.familyId));
  const item = await findItem(db, kid.familyId, taskId, today, null, { asMember: kid.childId });
  const rows = await db
    .update(taskDays)
    .set({ status: "todo", reportedByChildId: null, updatedAt: clock.now() })
    .where(
      and(
        eq(taskDays.taskId, taskId),
        eq(taskDays.date, today),
        item.childId === null ? isNull(taskDays.childId) : eq(taskDays.childId, item.childId),
        eq(taskDays.status, "pending"),
      ),
    )
    .returning({ id: taskDays.id });
  if (rows.length === 0) throw new DomainError("CONFLICT", "Nhiệm vụ không còn ở trạng thái chờ duyệt");
}

// ---------------------------------------------------------------- bố mẹ duyệt / từ chối / tự đánh dấu

function checkReviewDate(today: string, date: string) {
  if (date > today || date < addDays(today, -REVIEW_WINDOW_DAYS)) {
    throw invalid(`Chỉ duyệt được nhiệm vụ trong ${REVIEW_WINDOW_DAYS} ngày gần nhất`);
  }
}

/**
 * Duyệt nhiệm vụ đang chờ, hoặc tự đánh dấu hoàn thành nhiệm vụ con chưa báo (tối đa 7 ngày trước).
 * Riêng: cộng điểm cho con đó. Nhóm: cộng đủ điểm cho mỗi con được chọn (không rỗng, thuộc nhóm).
 * Chuyển sang "done" có điều kiện trong cùng transaction với việc ghi giao dịch, nên không cộng hai lần.
 */
export async function approveTaskDay(
  db: Db,
  input: { familyId: number; actorParentId: number; taskId: number; date: string; childId?: number; participantIds?: number[] },
  clock: Clock = systemClock,
): Promise<Transaction[]> {
  const today = dateInZone(clock.now(), await familyTz(db, input.familyId));
  checkReviewDate(today, input.date);
  const item = await findItem(db, input.familyId, input.taskId, input.date, input.childId ?? null);
  let recipients: number[];
  if (item.mode === "group") {
    recipients = [...new Set(input.participantIds ?? item.members.map((m) => m.id))];
    if (recipients.length === 0) throw invalid('Chọn ít nhất một con đã tham gia, hoặc dùng "Từ chối"');
    if (!recipients.every((id) => item.members.some((m) => m.id === id))) throw invalid("Con được chọn không thuộc nhóm của nhiệm vụ");
  } else {
    recipients = [item.childId!];
  }

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(taskDays)
      .values({ taskId: item.taskId, childId: item.childId, date: item.date, status: "done" })
      .onConflictDoUpdate({ ...rowTarget(item), set: { status: "done", rejectReason: null, updatedAt: clock.now() }, setWhere: sql`${taskDays.status} <> 'done'` })
      .returning({ id: taskDays.id });
    if (rows.length === 0) throw new DomainError("CONFLICT", ALREADY_DONE);
    const description = `${item.name} · ngày ${formatDate(item.date)}`;
    const txns: Transaction[] = [];
    for (const childId of recipients) {
      txns.push(
        await recordTransaction(tx, {
          familyId: input.familyId,
          childId,
          kind: "task",
          amount: item.points,
          description,
          actorParentId: input.actorParentId,
          refType: "task_day",
          refId: rows[0].id,
          allowArchived: true,
          notifyTitle: item.name,
        }),
      );
    }
    return txns;
  });
}

/** Từ chối nhiệm vụ đang chờ: trở lại "chưa làm" (nhóm: cả nhóm), các con liên quan thấy lý do, không ghi giao dịch. */
export async function rejectTaskDay(
  db: Db,
  input: { familyId: number; actorParentId: number; taskId: number; date: string; childId?: number; reason?: string },
  clock: Clock = systemClock,
): Promise<void> {
  const today = dateInZone(clock.now(), await familyTz(db, input.familyId));
  checkReviewDate(today, input.date);
  const item = await findItem(db, input.familyId, input.taskId, input.date, input.childId ?? null);
  const reason = input.reason?.trim() || null;
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(taskDays)
      .set({ status: "todo", rejectReason: reason, reportedByChildId: null, updatedAt: clock.now() })
      .where(
        and(
          eq(taskDays.taskId, item.taskId),
          eq(taskDays.date, item.date),
          item.childId === null ? isNull(taskDays.childId) : eq(taskDays.childId, item.childId),
          eq(taskDays.status, "pending"),
        ),
      )
      .returning({ id: taskDays.id });
    if (rows.length === 0) throw new DomainError("CONFLICT", "Nhiệm vụ không ở trạng thái chờ duyệt");
    for (const m of item.members) {
      await notifyRejected(tx, { childId: m.id, title: item.name, reason, refType: "task_day", refId: rows[0].id });
    }
  });
}
