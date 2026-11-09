import type { DayItem } from "@/server/domain/daily-tasks";
import { Icon } from "@/ui/icons";
import { Card, Chip } from "@/ui/primitives";
import { CancelReportButton, ReportButton } from "./task-buttons";

/** Nhiệm vụ hôm nay của con (spec daily-tasks "Con xem nhiệm vụ hôm nay"; mockup Main / WebKidHome). */
export function TodayTasks({ items, childId, currency }: { items: DayItem[]; childId: number; currency: string }) {
  const done = items.filter((i) => i.status === "done").length;
  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="today-title" className="font-display text-[22px] font-extrabold md:text-[26px]">
          Nhiệm vụ hôm nay
        </h2>
        {items.length > 0 && (
          <span className="text-sm font-bold text-muted">
            {done}/{items.length} xong
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <Card className="font-bold text-muted">Hôm nay con không có nhiệm vụ nào. Chơi vui nhé!</Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-3.5">
          {items.map((i) => {
            const reporter = i.members.find((m) => m.id === i.reportedByChildId);
            const others = i.members.filter((m) => m.id !== childId).map((m) => m.name);
            let sub = `+${i.points} ${currency}`;
            if (i.mode === "group" && i.status === "pending" && reporter) sub += ` · ${reporter.id === childId ? "Con" : reporter.name} đã báo xong`;
            if (i.status === "todo" && i.rejectReason) sub += ` · Bố mẹ nhắn: ${i.rejectReason}`;
            return (
              <Card key={i.key} className="flex items-center gap-3 md:flex-col md:items-stretch">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {i.mode === "group" && <Chip>Nhiệm vụ nhóm · {i.members.map((m) => m.name).join(", ")}</Chip>}
                  <span className="text-base font-extrabold md:text-lg">{i.name}</span>
                  <span className="text-[13px] font-bold text-muted md:text-sm">{sub}</span>
                  {i.mode === "group" && others.length > 0 && i.status === "todo" && (
                    <span className="sr-only">Làm cùng {others.join(", ")}</span>
                  )}
                </div>
                {i.status === "done" && (
                  <Chip tone="done" className="!px-3 !py-2 !text-sm">
                    <Icon name="check" size={16} /> Xong
                  </Chip>
                )}
                {i.status === "pending" && (
                  <div className="flex flex-col items-end gap-0.5 md:flex-row md:items-center md:justify-between">
                    <Chip tone="wait" className="!px-2.5 !py-1.5 !text-[13px]">
                      Chờ duyệt
                    </Chip>
                    <CancelReportButton taskId={i.taskId} />
                  </div>
                )}
                {i.status === "todo" && <ReportButton taskId={i.taskId} label={i.mode === "group" ? "Xong rồi" : "Con xong rồi"} />}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
