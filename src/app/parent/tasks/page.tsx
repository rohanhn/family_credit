import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getDay, listTasks, REVIEW_WINDOW_DAYS, weekdaysFromMask } from "@/server/domain/daily-tasks";
import { getFamily } from "@/server/domain/families";
import { addDays, dateInZone, formatDate, isDateString, weekdayIndex } from "@/lib/time";
import { ParentColumns } from "@/ui/parent-shell";
import { Button, Card, Chip } from "@/ui/primitives";
import { TaskDecision } from "../task-decision";
import { TaskCard, TaskForm, TaskRow } from "./task-form";

export const metadata: Metadata = { title: "Nhiệm vụ · Sao nhà mình" };

const DAY_NAMES = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function daysLabel(mask: number): string {
  const days = weekdaysFromMask(mask);
  if (days.length === 7) return "Hằng ngày";
  if (days.join() === "0,1,2,3,4") return "T2 – T6";
  return days.map((d) => SHORT[d]).join(", ");
}

const STATUS = {
  todo: { label: "Chưa làm", tone: "soft" as const },
  pending: { label: "Chờ duyệt", tone: "wait" as const },
  done: { label: "Hoàn thành", tone: "done" as const },
};

type SearchParams = Promise<{ date?: string }>;

const COLUMNS = ["NHIỆM VỤ", "ĐIỂM", "NGÀY", "GIAO CHO", "CÁCH LÀM", "TRẠNG THÁI", "THAO TÁC"];

async function Tasks({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const family = await getFamily(db, auth.familyId);
  const today = dateInZone(new Date(), family.timezone);
  const tomorrow = addDays(today, 1);
  const startLabel = `${DAY_NAMES[weekdayIndex(tomorrow)]}, ${formatDate(tomorrow).slice(0, 5)}`;
  const sp = await searchParams;
  const dates = Array.from({ length: REVIEW_WINDOW_DAYS + 1 }, (_, i) => addDays(today, -i));
  const date = sp.date && isDateString(sp.date) && dates.includes(sp.date) ? sp.date : today;

  const [kids, list, day] = await Promise.all([listChildren(db, auth.familyId), listTasks(db, auth.familyId), getDay(db, auth.familyId, date)]);
  const kidOptions = kids.map((k) => ({ id: k.id, name: k.name }));
  const items = list.map((tk) => ({
    id: tk.id,
    task: {
      taskId: tk.id,
      name: tk.name,
      points: tk.points,
      weekdays: weekdaysFromMask(tk.weekdaysMask),
      mode: tk.mode,
      assignAll: tk.assignAll,
      childIds: tk.assignees.map((a) => a.id),
      paused: tk.state === "paused",
    },
    info: {
      name: tk.name,
      points: `+${tk.points}`,
      days: daysLabel(tk.weekdaysMask),
      assignees: tk.assignAll ? "Tất cả các con" : tk.assignees.map((a) => a.name).join(", "),
      mode: <Chip>{tk.mode === "group" ? "Cả nhóm làm chung" : tk.assignAll || tk.assignees.length > 1 ? "Mỗi con làm riêng" : "Riêng một con"}</Chip>,
      state: (
        <Chip tone={tk.state === "active" ? "done" : tk.state === "paused" ? "soft" : "wait"}>
          {tk.state === "active" ? "Đang chạy" : tk.state === "paused" ? "Tạm dừng" : `Từ ${formatDate(tk.effectiveFrom).slice(0, 5)}`}
        </Chip>
      ),
    },
  }));

  return (
    <ParentColumns
      main={
        <>
          <h1 className="font-display text-3xl font-extrabold">Nhiệm vụ hằng ngày</h1>
          {list.length === 0 ? (
            <Card className="font-semibold text-muted">Chưa có nhiệm vụ nào. Tạo nhiệm vụ ở cột bên cạnh.</Card>
          ) : (
            <>
              {/* Hai cách trình bày từ cùng dữ liệu (design D4): cách bị ẩn có display:none nên không trùng nút. */}
              <div className="hidden overflow-x-auto rounded-[22px] bg-card shadow-flat md:block">
                <table className="w-full min-w-[560px] border-collapse text-[15px]">
                  <thead>
                    <tr className="text-left text-xs font-extrabold tracking-wide text-muted">
                      {COLUMNS.map((h) => (
                        <th key={h} scope="col" className={`whitespace-nowrap border-b border-black/5 px-3.5 py-3 ${h === "THAO TÁC" ? "text-right" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(({ id, task, info }) => (
                      <TaskRow
                        key={id}
                        colSpan={COLUMNS.length}
                        kids={kidOptions}
                        startLabel={startLabel}
                        task={task}
                        cells={
                          <>
                            <td className="font-extrabold">{info.name}</td>
                            <td className="font-display text-lg font-extrabold text-primary">{info.points}</td>
                            <td className="whitespace-nowrap font-bold text-muted">{info.days}</td>
                            <td className="font-bold">{info.assignees}</td>
                            <td>{info.mode}</td>
                            <td className="whitespace-nowrap">{info.state}</td>
                          </>
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <ul aria-label="Danh sách nhiệm vụ" className="flex flex-col gap-3 md:hidden">
                {items.map(({ id, task, info }) => (
                  <TaskCard
                    key={id}
                    kids={kidOptions}
                    startLabel={startLabel}
                    task={task}
                    body={
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 break-words text-[17px] font-extrabold">{info.name}</span>
                          <span className="shrink-0 font-display text-lg font-extrabold text-primary">{info.points}</span>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px]">
                          <dt className="font-extrabold text-muted">Ngày</dt>
                          <dd className="font-bold">{info.days}</dd>
                          <dt className="font-extrabold text-muted">Giao cho</dt>
                          <dd className="min-w-0 break-words font-bold">{info.assignees}</dd>
                        </dl>
                        <div className="flex flex-wrap gap-1.5">
                          {info.mode}
                          {info.state}
                        </div>
                      </div>
                    }
                  />
                ))}
              </ul>
            </>
          )}
          <p className="text-[13px] font-semibold text-muted">Mọi thay đổi (sửa điểm, tạm dừng, đổi người được giao) có hiệu lực từ ngày hôm sau.</p>

          <section aria-labelledby="day-title" className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="day-title" className="font-display text-2xl font-extrabold">
                Theo ngày: {date === today ? "hôm nay" : formatDate(date)}
              </h2>
              <form method="get" className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-[13px] font-extrabold text-muted">
                  Chọn ngày (7 ngày gần nhất)
                  <select name="date" defaultValue={date} className="min-h-11 rounded-xl border-2 border-black/15 bg-card px-3 text-base font-bold text-ink">
                    {dates.map((d, i) => (
                      <option key={d} value={d}>
                        {i === 0 ? "Hôm nay" : i === 1 ? "Hôm qua" : `${DAY_NAMES[weekdayIndex(d)]} ${formatDate(d).slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" variant="soft">
                  Xem
                </Button>
              </form>
            </div>
            {day.length === 0 ? (
              <Card className="font-semibold text-muted">Không có nhiệm vụ nào trong ngày này.</Card>
            ) : (
              day.map((i) => {
                const reporter = i.reporterName;
                return (
                  <Card key={i.key} className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Chip>
                        {i.mode === "group" && <Chip>Nhiệm vụ nhóm · {i.members.map((m) => m.name).join(", ")}</Chip>}
                      </div>
                      <span className="text-[17px] font-extrabold">
                        {i.mode === "group" ? i.name : `${i.members[0].name} · ${i.name}`} <span className="text-plus">+{i.points}</span>
                      </span>
                      {i.status === "pending" && reporter && <span className="text-[13px] font-semibold text-muted">{reporter} đã báo xong</span>}
                      {i.status === "todo" && i.rejectReason && <span className="text-[13px] font-semibold text-muted">Đã từ chối: {i.rejectReason}</span>}
                    </div>
                    {i.status !== "done" && <TaskDecision taskId={i.taskId} date={i.date} childId={i.childId} members={i.members} pending={i.status === "pending"} />}
                  </Card>
                );
              })
            )}
          </section>
        </>
      }
      aside={
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-display text-[22px] font-extrabold">Nhiệm vụ mới</h2>
          {kids.length === 0 ? <p className="font-semibold text-muted">Thêm con trong Cài đặt trước nhé.</p> : <TaskForm kids={kidOptions} startLabel={startLabel} />}
        </Card>
      }
    />
  );
}

export default function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Tasks searchParams={searchParams} />
    </Suspense>
  );
}
