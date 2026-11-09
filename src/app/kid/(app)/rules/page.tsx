import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { listChildClaims } from "@/server/domain/rule-claims";
import { listRules } from "@/server/domain/rules";
import { signed } from "@/lib/time";
import { Card, Chip } from "@/ui/primitives";
import { CancelClaimButton, ClaimButton } from "./claim-forms";

export const metadata: Metadata = { title: "Rule · Sao nhà mình" };

async function KidRules() {
  const kid = await requireChild();
  const db = getDb();
  const [rules, pending, currency] = await Promise.all([listRules(db, kid.familyId), listChildClaims(db, kid.childId, "pending"), getCurrency(db, kid.familyId)]);
  const reward = rules.filter((r) => r.kind === "reward");
  const penalty = rules.filter((r) => r.kind === "penalty");

  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold">Rule của nhà mình</h1>

      {pending.length > 0 && (
        <section aria-label="Đang chờ bố mẹ duyệt" className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-extrabold">Đang chờ bố mẹ duyệt</h2>
          {pending.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 bg-wait-bg text-wait-fg">
              <span className="flex flex-1 flex-col">
                <span className="font-extrabold">{c.nameSnapshot}</span>
                <span className="text-sm font-bold">
                  {signed(c.pointsSnapshot)} {currency.name}
                  {c.note ? ` · “${c.note}”` : ""}
                </span>
              </span>
              <CancelClaimButton claimId={c.id} />
            </Card>
          ))}
        </section>
      )}

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
