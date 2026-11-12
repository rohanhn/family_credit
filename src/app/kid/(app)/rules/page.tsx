import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { listChildProposals, MAX_PENDING_PROPOSALS } from "@/server/domain/adhoc-proposals";
import { getCurrency } from "@/server/domain/currency";
import { listChildClaims } from "@/server/domain/rule-claims";
import { listRules } from "@/server/domain/rules";
import { signed } from "@/lib/time";
import { Card, Chip } from "@/ui/primitives";
import { CancelClaimButton, ClaimButton } from "./claim-forms";
import { CancelProposalButton, ProposalSection } from "./proposal-forms";

export const metadata: Metadata = { title: "Rule · Sao nhà mình" };

async function KidRules() {
  const kid = await requireChild();
  const db = getDb();
  const [rules, claims, proposals, currency] = await Promise.all([
    listRules(db, kid.familyId),
    listChildClaims(db, kid.childId, "pending"),
    listChildProposals(db, kid.childId, "pending"),
    getCurrency(db, kid.familyId),
  ]);
  // Khai rule và đề xuất ngoài rule hiện chung một danh sách, mới nhất trước.
  const pending = [
    ...claims.map((c) => ({ key: `claim-${c.id}`, at: c.createdAt, title: c.nameSnapshot, points: c.pointsSnapshot, extra: c.note ? `“${c.note}”` : "", cancel: <CancelClaimButton claimId={c.id} /> })),
    ...proposals.map((p) => ({
      key: `proposal-${p.id}`,
      at: p.createdAt,
      title: p.description,
      points: p.kind === "reward" ? p.proposedPoints : -p.proposedPoints,
      extra: p.kind === "reward" ? "con xin thưởng" : "con tự nhận phạt",
      cancel: <CancelProposalButton proposalId={p.id} />,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const reward = rules.filter((r) => r.kind === "reward");
  const penalty = rules.filter((r) => r.kind === "penalty");

  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold">Rule của nhà mình</h1>

      {pending.length > 0 && (
        <section aria-label="Đang chờ bố mẹ duyệt" className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-extrabold">Đang chờ bố mẹ duyệt</h2>
          {pending.map((item) => (
            <Card key={item.key} className="flex items-center gap-3 bg-wait-bg text-wait-fg">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold break-words">{item.title}</span>
                <span className="text-sm font-bold">
                  {signed(item.points)} {currency.name}
                  {item.extra ? ` · ${item.extra}` : ""}
                </span>
              </span>
              {item.cancel}
            </Card>
          ))}
        </section>
      )}

      <ProposalSection currencyName={currency.name} atLimit={proposals.length >= MAX_PENDING_PROPOSALS} limit={MAX_PENDING_PROPOSALS} />

      <section aria-label="Được thưởng" className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-extrabold">Được thưởng</h2>
        {reward.length === 0 && <p className="font-semibold text-muted">Chưa có rule thưởng.</p>}
        {reward.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center gap-3">
            <span className="flex flex-1 flex-col">
              <span className="text-[17px] font-extrabold">{r.name}</span>
              <span className="font-bold text-plus">
                {signed(r.points)} {currency.name}
              </span>
            </span>
            <ClaimButton ruleId={r.id} ruleName={r.name} />
          </Card>
        ))}
      </section>

      <section aria-label="Bị trừ" className="flex flex-col gap-2">
        <h2 className="font-display text-xl font-extrabold">Bị trừ</h2>
        {penalty.length === 0 && <p className="font-semibold text-muted">Chưa có rule phạt.</p>}
        {penalty.map((r) => (
          <Card key={r.id} className="flex items-center gap-3">
            <span className="flex-1 text-[17px] font-extrabold">{r.name}</span>
            <Chip className="text-sm">
              {signed(-r.points)} {currency.name}
            </Chip>
          </Card>
        ))}
      </section>
    </>
  );
}

export default function KidRulesPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidRules />
    </Suspense>
  );
}
