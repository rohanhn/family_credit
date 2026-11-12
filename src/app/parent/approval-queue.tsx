import type { ReactNode } from "react";
import { approveClaimAction, approveProposalAction, rejectClaimAction, rejectProposalAction } from "@/app/actions/rules";
import { approveRedemptionAction, rejectRedemptionAction } from "@/app/actions/shop";
import type { DbOrTx } from "@/server/db/types";
import { listPendingProposals } from "@/server/domain/adhoc-proposals";
import { listPendingTaskDays } from "@/server/domain/daily-tasks";
import { listPendingClaims } from "@/server/domain/rule-claims";
import { listPendingRedemptions } from "@/server/domain/shop";
import { dateInZone, formatDate, formatDateTime, signed } from "@/lib/time";
import { Card, Chip } from "@/ui/primitives";
import { DecisionForm, PointsField } from "./decision-form";
import { TaskDecision } from "./task-decision";

// Hàng chờ duyệt chung của gia đình (design D3): gộp các nguồn đang chờ.
// Nguồn: nhiệm vụ đã báo xong, khai rule thưởng, đề xuất ngoài rule của con, yêu cầu đổi thưởng.

export type QueueItem = {
  key: string;
  tag: string;
  title: string;
  /** Con đã lưu trữ: gắn nhãn "đã lưu trữ" cạnh tên (spec family-accounts "Yêu cầu gửi trước khi lưu trữ"). */
  childArchived?: boolean;
  meta: string;
  amount: number;
  amountSuffix?: string;
  /** Cảnh báo hiện dưới tiêu đề (ví dụ số dư không đủ để duyệt đổi thưởng). */
  warning?: string;
  decision: ReactNode;
  createdAt: Date;
};

export async function loadQueue(db: DbOrTx, familyId: number, timezone: string): Promise<QueueItem[]> {
  const [claims, proposals, taskItems, redemptions] = await Promise.all([
    listPendingClaims(db, familyId),
    listPendingProposals(db, familyId),
    listPendingTaskDays(db, familyId),
    listPendingRedemptions(db, familyId),
  ]);
  const today = dateInZone(new Date(), timezone);
  const tasks: QueueItem[] = taskItems.map((i) => {
    const reporter = i.reporterName;
    const day = i.date === today ? "" : ` · ngày ${formatDate(i.date)}`;
    return {
      key: `task-${i.key}-${i.date}`,
      tag: i.mode === "group" ? "Nhiệm vụ nhóm" : "Nhiệm vụ",
      title: i.mode === "group" ? i.name : `${i.members[0]?.name} · ${i.name}`,
      childArchived: i.childArchived,
      meta: `${reporter ? `${reporter} báo xong` : "Đã báo xong"}${i.mode === "group" ? ` cho cả nhóm (${i.members.map((m) => m.name).join(", ")})` : ""}${day}`,
      amount: i.points,
      amountSuffix: i.mode === "group" ? " mỗi con" : undefined,
      decision: <TaskDecision taskId={i.taskId} date={i.date} childId={i.childId} members={i.members} pending />,
      createdAt: new Date(`${i.date}T00:00:00Z`),
    };
  });
  const items: QueueItem[] = claims.map((c) => ({
    key: `claim-${c.id}`,
    tag: "Khai rule",
    title: `${c.childName} · ${c.nameSnapshot}`,
    childArchived: c.childArchived,
    meta: `${c.childName} khai lúc ${formatDateTime(c.createdAt, timezone)}${c.note ? ` · “${c.note}”` : ""}`,
    amount: c.pointsSnapshot,
    decision: <DecisionForm id={c.id} approve={approveClaimAction} reject={rejectClaimAction} />,
    createdAt: c.createdAt,
  }));
  const proposed: QueueItem[] = proposals.map((p) => ({
    key: `proposal-${p.id}`,
    tag: p.kind === "reward" ? "Xin thưởng" : "Tự nhận phạt",
    title: `${p.childName} · ${p.description}`,
    childArchived: p.childArchived,
    meta: `${p.childName} gửi lúc ${formatDateTime(p.createdAt, timezone)}`,
    amount: p.kind === "reward" ? p.proposedPoints : -p.proposedPoints,
    warning:
      p.kind === "penalty" && p.proposedPoints > p.balance
        ? `Số dư hiện tại (${p.balance}) chỉ đủ trừ ${p.balance}; lịch sử vẫn ghi mức gốc.`
        : undefined,
    decision: (
      <DecisionForm id={p.id} approve={approveProposalAction} reject={rejectProposalAction} extra={<PointsField defaultPoints={p.proposedPoints} />} />
    ),
    createdAt: p.createdAt,
  }));
  const redeems: QueueItem[] = redemptions.map((r) => ({
    key: `redeem-${r.id}`,
    tag: "Đổi thưởng",
    title: `${r.childName} · ${r.nameSnapshot}`,
    childArchived: r.childArchived,
    meta: `${r.childName} gửi lúc ${formatDateTime(r.createdAt, timezone)} · số dư hiện tại ${r.balance}`,
    amount: -r.priceSnapshot,
    warning: r.balance < r.priceSnapshot ? `Số dư hiện tại (${r.balance}) không đủ để duyệt; có thể từ chối kèm lý do.` : undefined,
    decision: <DecisionForm id={r.id} approve={approveRedemptionAction} reject={rejectRedemptionAction} />,
    createdAt: r.createdAt,
  }));
  return [...tasks, ...items, ...proposed, ...redeems].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function ApprovalQueue({ items }: { items: QueueItem[] }) {
  return (
    <>
      <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold">
        Chờ duyệt <Chip tone="primary">{items.length}</Chip>
      </h2>
      {items.length === 0 ? (
        <Card className="p-6 text-center font-bold text-muted">Đã duyệt hết. Các con giỏi quá!</Card>
      ) : (
        items.map((it) => (
          <Card key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip>{it.tag}</Chip>
                <span className="text-[13px] font-semibold text-muted">{it.meta}</span>
              </div>
              <span className="text-[17px] font-extrabold">
                {it.title}{" "}
                {it.childArchived && (
                  <Chip className="align-middle">
                    đã lưu trữ
                  </Chip>
                )}{" "}
                <span className={it.amount >= 0 ? "text-plus" : "text-minus"}>
                  {signed(it.amount)}
                  {it.amountSuffix ?? ""}
                </span>
              </span>
              {it.warning && <span className="w-fit rounded-xl bg-wait-bg px-2.5 py-1 text-[13px] font-bold text-wait-fg">{it.warning}</span>}
            </div>
            {it.decision}
          </Card>
        ))
      )}
    </>
  );
}
