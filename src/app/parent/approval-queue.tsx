import type { ReactNode } from "react";
import { approveClaimAction, rejectClaimAction } from "@/app/actions/rules";
import type { DbOrTx } from "@/server/db/types";
import { listPendingClaims } from "@/server/domain/rule-claims";
import { formatDateTime, signed } from "@/lib/time";
import { Card, Chip } from "@/ui/primitives";
import { DecisionForm } from "./decision-form";

// Hàng chờ duyệt chung của gia đình (design D3): gộp các nguồn đang chờ.
// Task 4.2: khai rule. Nhiệm vụ (5.5) và đổi thưởng (6.2) thêm nguồn vào `loadQueue`.

export type QueueItem = {
  key: string;
  tag: string;
  title: string;
  meta: string;
  amount: number;
  amountSuffix?: string;
  decision: ReactNode;
  createdAt: Date;
};

export async function loadQueue(db: DbOrTx, familyId: number, timezone: string): Promise<QueueItem[]> {
  const claims = await listPendingClaims(db, familyId);
  const items: QueueItem[] = claims.map((c) => ({
    key: `claim-${c.id}`,
    tag: "Khai rule",
    title: `${c.childName} · ${c.nameSnapshot}`,
    meta: `${c.childName} khai lúc ${formatDateTime(c.createdAt, timezone)}${c.note ? ` · “${c.note}”` : ""}`,
    amount: c.pointsSnapshot,
    decision: <DecisionForm id={c.id} approve={approveClaimAction} reject={rejectClaimAction} />,
    createdAt: c.createdAt,
  }));
  return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
                <span className={it.amount >= 0 ? "text-plus" : "text-minus"}>
                  {signed(it.amount)}
                  {it.amountSuffix ?? ""}
                </span>
              </span>
            </div>
            {it.decision}
          </Card>
        ))
      )}
    </>
  );
}
