import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DAY, fixedClock, HOUR } from "@/server/clock";
import { children, families, parents } from "@/server/db/schema";
import { archiveChild, createChild } from "@/server/domain/children";
import {
  approveTaskDay,
  cancelReport,
  createTask,
  getChildToday,
  getDay,
  listPendingTaskDays,
  listTasks,
  pauseTask,
  rejectTaskDay,
  reportDone,
  resumeTask,
  updateTask,
  type TaskInput,
} from "@/server/domain/daily-tasks";
import { getBalance, listTransactions } from "@/server/domain/ledger";
import { getUnreadSummary } from "@/server/domain/notifications";
import { createTestDb, type TestDb } from "../helpers/db";

let t: TestDb;
// Thứ Hai 9/11/2026, 10:00 giờ Việt Nam.
const clock = fixedClock("2026-11-09T03:00:00Z");
const MON_FRI = [0, 1, 2, 3, 4];
const ALL = [0, 1, 2, 3, 4, 5, 6];

beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T03:00:00Z");
});
afterEach(async () => {
  await t.close();
});

async function setup(names = ["Bin", "Na", "Su"]) {
  const [family] = await t.db.insert(families).values({ name: "Nhà A" }).returning();
  const [parent] = await t.db.insert(parents).values({ familyId: family.id, email: "bo@example.com", displayName: "Bố", passwordHash: "x" }).returning();
  const kids = [];
  for (const name of names) {
    // Hồ sơ con tạo từ trước để không vướng quy tắc "con mới từ hôm sau".
    const [k] = await t.db.insert(children).values({ familyId: family.id, name, avatar: "boy-brown", pinHash: "x", createdAt: new Date("2026-11-01T00:00:00Z") }).returning();
    kids.push(k);
  }
  const familyId = family.id;
  const task = (input: Partial<TaskInput> & { name: string; points: number }) =>
    createTask(t.db, familyId, { weekdays: ALL, mode: "individual", assignAll: false, childIds: [], ...input }, clock);
  const today = async (childId: number) => (await getChildToday(t.db, familyId, childId, clock)).items;
  const kid = (childId: number) => ({ familyId, childId });
  const parentInput = { familyId, actorParentId: parent.id };
  return { familyId, parent, kids, task, today, kid, parentInput };
}

const nextDay = () => clock.advance(DAY);

describe("5.1 Ngày theo múi giờ gia đình và danh sách nhiệm vụ trong ngày", () => {
  it("Qua nửa đêm Asia/Ho_Chi_Minh: danh sách chuyển sang ngày mới", async () => {
    const { kids, task, today, kid } = await setup();
    const tk = await task({ name: "Đánh răng", points: 5, childIds: [kids[0].id] });
    nextDay();
    await reportDone(t.db, kid(kids[0].id), tk.id, clock);
    clock.set("2026-11-10T16:59:00Z"); // 23:59 ngày 10/11 giờ VN
    expect((await getChildToday(t.db, kids[0].familyId, kids[0].id, clock)).date).toBe("2026-11-10");
    expect((await today(kids[0].id))[0].status).toBe("pending");
    clock.set("2026-11-10T17:00:00Z"); // 00:00 ngày 11/11 giờ VN
    expect((await getChildToday(t.db, kids[0].familyId, kids[0].id, clock)).date).toBe("2026-11-11");
    expect((await today(kids[0].id))[0].status).toBe("todo");
  });

  it("Ngày không áp dụng: nhiệm vụ thứ Hai–thứ Sáu không có vào Chủ nhật", async () => {
    const { kids, task, today } = await setup();
    await task({ name: "Làm bài tập", points: 15, weekdays: MON_FRI, childIds: [kids[0].id] });
    clock.set("2026-11-14T03:00:00Z"); // thứ Bảy
    expect(await today(kids[0].id)).toEqual([]);
    clock.set("2026-11-15T03:00:00Z"); // Chủ nhật
    expect(await today(kids[0].id)).toEqual([]);
    clock.set("2026-11-16T03:00:00Z"); // thứ Hai
    expect((await today(kids[0].id)).map((i) => i.name)).toEqual(["Làm bài tập"]);
  });

  it("Tạm dừng có hiệu lực từ hôm sau; các ngày trước giữ trạng thái", async () => {
    const { familyId, kids, task, today, kid, parentInput } = await setup();
    const tk = await task({ name: "Dọn phòng", points: 10, childIds: [kids[0].id, kids[1].id], mode: "individual" });
    nextDay();
    await reportDone(t.db, kid(kids[0].id), tk.id, clock);
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: kids[0].id }, clock);
    await pauseTask(t.db, familyId, tk.id, clock);
    expect(await today(kids[1].id)).toHaveLength(1); // hôm nay vẫn còn
    nextDay();
    expect(await today(kids[0].id)).toEqual([]);
    expect(await today(kids[1].id)).toEqual([]);
    const past = await getDay(t.db, familyId, "2026-11-10");
    expect(past.find((i) => i.childId === kids[0].id)?.status).toBe("done");
    expect((await listTasks(t.db, familyId, clock))[0].state).toBe("paused");
    await resumeTask(t.db, familyId, tk.id, clock);
    nextDay();
    expect(await today(kids[0].id)).toHaveLength(1);
  });

  it('"Tất cả các con" gồm cả con mới, từ ngày hôm sau', async () => {
    const { familyId, task, today } = await setup(["Bin"]);
    await task({ name: "Tưới cây", points: 3, assignAll: true });
    nextDay();
    const tí = await createChild(t.db, familyId, { name: "Tí", avatar: "boy-black", pin: "1111" });
    await t.db.update(children).set({ createdAt: clock.now() }).where(eq(children.id, tí.id));
    expect(await today(tí.id)).toEqual([]);
    nextDay();
    expect((await today(tí.id)).map((i) => i.name)).toEqual(["Tưới cây"]);
  });

  it("Con đã lưu trữ không còn nhiệm vụ; ngày trước vẫn giữ trạng thái", async () => {
    const { familyId, kids, task, today, kid } = await setup();
    const tk = await task({ name: "Đọc sách", points: 5, assignAll: true });
    nextDay();
    await reportDone(t.db, kid(kids[0].id), tk.id, clock);
    await archiveChild(t.db, familyId, kids[0].id, clock);
    expect(await today(kids[0].id)).toEqual([]);
    nextDay();
    expect((await getDay(t.db, familyId, "2026-11-11")).some((i) => i.childId === kids[0].id)).toBe(false);
  });
});

describe("5.2 Giao nhiệm vụ và chọn con", () => {
  it("Giao riêng cho một con thứ Hai–thứ Sáu: chỉ con đó thấy", async () => {
    const { kids, task, today } = await setup();
    const tk = await task({ name: "Làm bài tập", points: 15, weekdays: MON_FRI, childIds: [kids[0].id] });
    expect(tk.mode).toBe("individual");
    nextDay();
    expect((await today(kids[0].id)).map((i) => [i.name, i.points])).toEqual([["Làm bài tập", 15]]);
    expect(await today(kids[1].id)).toEqual([]);
  });

  it("Nhiệm vụ mới có hiệu lực từ ngày mai", async () => {
    const { kids, task, today } = await setup();
    await task({ name: "Mới", points: 1, childIds: [kids[0].id] });
    expect(await today(kids[0].id)).toEqual([]);
    nextDay();
    expect(await today(kids[0].id)).toHaveLength(1);
  });

  it("Chọn hai trong ba con: chỉ hai con đó thấy", async () => {
    const { kids, task, today } = await setup();
    await task({ name: "Rửa bát", points: 5, childIds: [kids[0].id, kids[1].id] });
    nextDay();
    expect(await today(kids[0].id)).toHaveLength(1);
    expect(await today(kids[1].id)).toHaveLength(1);
    expect(await today(kids[2].id)).toEqual([]);
  });

  it("Không chọn con nào: từ chối", async () => {
    const { task } = await setup();
    await expect(task({ name: "X", points: 5, childIds: [] })).rejects.toMatchObject({ message: "Chọn ít nhất một con" });
  });

  it("Không giao được con của gia đình khác; dữ liệu không hợp lệ bị từ chối", async () => {
    const { familyId, task } = await setup();
    const [other] = await t.db.insert(families).values({ name: "Khác" }).returning();
    const ot = await createChild(t.db, other.id, { name: "Ngoài", avatar: "boy-brown", pin: "1234" });
    await expect(task({ name: "X", points: 5, childIds: [ot.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(task({ name: "X", points: 0, assignAll: true })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(task({ name: "X", points: 5, assignAll: true, weekdays: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await listTasks(t.db, familyId, clock)).toEqual([]);
  });

  it("Sửa điểm nhiệm vụ của ba con từ 5 lên 8: hôm nay vẫn 5, từ hôm sau 8", async () => {
    const { familyId, kids, task, today } = await setup();
    const tk = await task({ name: "Đánh răng tối", points: 5, mode: "individual", childIds: kids.map((k) => k.id) });
    nextDay();
    await updateTask(t.db, familyId, tk.id, { name: "Đánh răng tối", points: 8, weekdays: ALL, mode: "individual", assignAll: false, childIds: kids.map((k) => k.id) }, clock);
    for (const k of kids) expect((await today(k.id))[0].points).toBe(5);
    nextDay();
    for (const k of kids) expect((await today(k.id))[0].points).toBe(8);
    const list = await listTasks(t.db, familyId, clock);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ points: 8, state: "active" });
  });
});

describe("5.3 Nhiệm vụ riêng", () => {
  async function individual(points = 15) {
    const s = await setup();
    const tk = await s.task({ name: "Làm bài tập", points, childIds: [s.kids[0].id, s.kids[1].id] });
    nextDay();
    return { ...s, tk, bin: s.kids[0], na: s.kids[1] };
  }

  it("Báo hoàn thành: chờ duyệt, số dư chưa đổi; hủy báo trở lại chưa làm", async () => {
    const { tk, bin, today, kid } = await individual();
    await reportDone(t.db, kid(bin.id), tk.id, clock);
    expect((await today(bin.id))[0]).toMatchObject({ status: "pending", reportedByChildId: bin.id });
    expect(await getBalance(t.db, bin.id)).toBe(0);
    await cancelReport(t.db, kid(bin.id), tk.id, clock);
    expect((await today(bin.id))[0].status).toBe("todo");
  });

  it("Duyệt nhiệm vụ riêng: hoàn thành và +15 loại nhiệm vụ", async () => {
    const { tk, bin, today, kid, parentInput, familyId } = await individual();
    await reportDone(t.db, kid(bin.id), tk.id, clock);
    expect((await listPendingTaskDays(t.db, familyId, clock)).map((i) => i.childId)).toEqual([bin.id]);
    const [txn] = await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id }, clock);
    expect(txn).toMatchObject({ kind: "task", appliedAmount: 15, refType: "task_day" });
    expect((await today(bin.id))[0].status).toBe("done");
    expect((await getUnreadSummary(t.db, bin.id)).items[0]).toMatchObject({ kind: "gift", title: "Làm bài tập", amount: 15 });
  });

  it("Hai con làm cùng nhiệm vụ: độc lập với nhau", async () => {
    const { tk, bin, na, today, kid, parentInput } = await individual(5);
    await reportDone(t.db, kid(bin.id), tk.id, clock);
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id }, clock);
    expect(await getBalance(t.db, bin.id)).toBe(5);
    expect((await today(na.id))[0].status).toBe("todo");
    expect(await getBalance(t.db, na.id)).toBe(0);
  });

  it("Từ chối kèm lý do: trở lại chưa làm, con thấy lý do, không có giao dịch", async () => {
    const { tk, bin, today, kid, parentInput, familyId } = await individual();
    await reportDone(t.db, kid(bin.id), tk.id, clock);
    await rejectTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id, reason: "Chưa làm xong bài toán" }, clock);
    expect((await today(bin.id))[0]).toMatchObject({ status: "todo", rejectReason: "Chưa làm xong bài toán" });
    expect((await getUnreadSummary(t.db, bin.id)).items[0]).toMatchObject({ kind: "rejected", reason: "Chưa làm xong bài toán" });
    expect(await listTransactions(t.db, { familyId })).toEqual([]);
    // Báo lại thì lý do cũ biến mất.
    await reportDone(t.db, kid(bin.id), tk.id, clock);
    expect((await today(bin.id))[0].rejectReason).toBeNull();
  });

  it("Bố mẹ tự đánh dấu nhiệm vụ con chưa báo", async () => {
    const { tk, na, today, parentInput } = await individual();
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: na.id }, clock);
    expect((await today(na.id))[0].status).toBe("done");
    expect(await getBalance(t.db, na.id)).toBe(15);
  });

  it("Không cộng hai lần; không báo lại nhiệm vụ đã hoàn thành", async () => {
    const { tk, bin, kid, parentInput } = await individual();
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id }, clock);
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id }, clock)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reportDone(t.db, kid(bin.id), tk.id, clock)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await getBalance(t.db, bin.id)).toBe(15);
  });

  it("Duyệt muộn trong 7 ngày: giao dịch ghi rõ ngày; quá 7 ngày bị từ chối", async () => {
    const { tk, bin, kid, parentInput } = await individual();
    await reportDone(t.db, kid(bin.id), tk.id, clock); // 10/11
    nextDay(); // sáng 11/11
    const [txn] = await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: bin.id }, clock);
    expect(txn.description).toBe("Làm bài tập · ngày 10/11/2026");
    clock.advance(7 * DAY); // 18/11: ngày 10/11 đã quá 7 ngày
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", childId: kid(bin.id).childId }, clock)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-19", childId: bin.id }, clock)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("Con chỉ báo được nhiệm vụ có trong hôm nay", async () => {
    const s = await setup();
    const tk = await s.task({ name: "Chỉ thứ Hai", points: 5, weekdays: [0], childIds: [s.kids[0].id] });
    nextDay(); // thứ Ba
    await expect(reportDone(t.db, s.kid(s.kids[0].id), tk.id, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Con khác (không được giao) cũng không báo được.
    clock.set("2026-11-16T03:00:00Z");
    await expect(reportDone(t.db, s.kid(s.kids[1].id), tk.id, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("5.4 Nhiệm vụ cả nhóm làm chung", () => {
  async function group() {
    const s = await setup();
    const tk = await s.task({ name: "Dọn phòng chơi", points: 20, mode: "group", childIds: s.kids.map((k) => k.id) });
    nextDay();
    return { ...s, tk, ids: s.kids.map((k) => k.id) };
  }

  it("Một con báo xong: chờ duyệt với mọi con trong nhóm, kèm tên con đã báo; ai trong nhóm cũng hủy được", async () => {
    const { tk, kids, ids, today, kid } = await group();
    await reportDone(t.db, kid(kids[1].id), tk.id, clock);
    for (const id of ids) {
      expect((await today(id))[0]).toMatchObject({ mode: "group", status: "pending", reportedByChildId: kids[1].id });
      expect((await today(id))[0].members.map((m) => m.name)).toEqual(["Bin", "Na", "Su"]);
    }
    // Báo trùng không đổi tên người báo đầu tiên.
    await reportDone(t.db, kid(kids[0].id), tk.id, clock);
    expect((await today(kids[0].id))[0].reportedByChildId).toBe(kids[1].id);
    await cancelReport(t.db, kid(kids[2].id), tk.id, clock);
    expect((await today(kids[0].id))[0].status).toBe("todo");
  });

  it("Duyệt nhiệm vụ nhóm giữ chọn cả ba: mỗi con +20 loại nhiệm vụ", async () => {
    const { tk, ids, today, kid, parentInput } = await group();
    await reportDone(t.db, kid(ids[0]), tk.id, clock);
    const txns = await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10" }, clock);
    expect(txns.map((x) => [x.childId, x.appliedAmount, x.kind])).toEqual(ids.map((id) => [id, 20, "task"]));
    for (const id of ids) expect((await today(id))[0].status).toBe("done");
  });

  it("Một con không tham gia: chỉ con được chọn được cộng, nhóm vẫn hoàn thành", async () => {
    const { tk, ids, today, kid, parentInput } = await group();
    await reportDone(t.db, kid(ids[0]), tk.id, clock);
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", participantIds: [ids[0], ids[1]] }, clock);
    expect([await getBalance(t.db, ids[0]), await getBalance(t.db, ids[1]), await getBalance(t.db, ids[2])]).toEqual([20, 20, 0]);
    expect((await today(ids[2]))[0].status).toBe("done");
    expect((await getUnreadSummary(t.db, ids[2])).count).toBe(0);
  });

  it('Bỏ chọn tất cả: từ chối thao tác duyệt và gợi ý dùng "Từ chối"', async () => {
    const { tk, ids, kid, parentInput } = await group();
    await reportDone(t.db, kid(ids[0]), tk.id, clock);
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", participantIds: [] }, clock)).rejects.toMatchObject({ message: expect.stringContaining('"Từ chối"') });
  });

  it("Con không thuộc nhóm không được chọn", async () => {
    const { tk, familyId, ids, parentInput } = await group();
    const outsider = await createChild(t.db, familyId, { name: "Ngoài", avatar: "boy-brown", pin: "1234" });
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", participantIds: [ids[0], outsider.id] }, clock)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("Duyệt hai lần: từ chối, không ghi thêm giao dịch", async () => {
    const { tk, familyId, parentInput } = await group();
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10" }, clock);
    await expect(approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10" }, clock)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await listTransactions(t.db, { familyId })).toHaveLength(3);
  });

  it("Từ chối nhiệm vụ nhóm: cả nhóm trở lại chưa làm, mỗi con có thông báo kèm lý do", async () => {
    const { tk, ids, today, kid, parentInput, familyId } = await group();
    await reportDone(t.db, kid(ids[0]), tk.id, clock);
    await rejectTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", reason: "Còn đồ chơi dưới gầm giường" }, clock);
    for (const id of ids) {
      expect((await today(id))[0]).toMatchObject({ status: "todo", rejectReason: "Còn đồ chơi dưới gầm giường" });
      expect((await getUnreadSummary(t.db, id)).items[0]).toMatchObject({ kind: "rejected", reason: "Còn đồ chơi dưới gầm giường" });
    }
    expect(await listTransactions(t.db, { familyId })).toEqual([]);
  });

  it("Bố mẹ tự đánh dấu nhiệm vụ nhóm chưa báo, cho những con được chọn", async () => {
    const { tk, ids, parentInput } = await group();
    await approveTaskDay(t.db, { ...parentInput, taskId: tk.id, date: "2026-11-10", participantIds: [ids[2]] }, clock);
    expect(await getBalance(t.db, ids[2])).toBe(20);
    expect(await getBalance(t.db, ids[0])).toBe(0);
  });
});

it("giờ trong ngày không ảnh hưởng ngày của nhiệm vụ (sáng sớm theo giờ VN)", async () => {
  const s = await setup(["Bin"]);
  await s.task({ name: "Sớm", points: 1, childIds: [s.kids[0].id] });
  clock.set("2026-11-09T17:30:00Z"); // 00:30 ngày 10/11 giờ VN
  expect(await s.today(s.kids[0].id)).toHaveLength(1);
  clock.advance(-HOUR); // 23:30 ngày 9/11 giờ VN
  expect(await s.today(s.kids[0].id)).toEqual([]);
});
