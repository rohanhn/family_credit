import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getCurrency } from "@/server/domain/currency";
import { getBalance } from "@/server/domain/ledger";
import { listRules } from "@/server/domain/rules";
import { ApplyPanel } from "./apply-panel";

export const metadata: Metadata = { title: "Thưởng / Phạt · Sao nhà mình" };

type SearchParams = Promise<{ child?: string; kind?: string }>;

async function Apply({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireParentWithFamily();
  const sp = await searchParams;
  const db = getDb();
  const [kids, rules, currency] = await Promise.all([listChildren(db, auth.familyId), listRules(db, auth.familyId), getCurrency(db, auth.familyId)]);
  const balances = await Promise.all(kids.map((k) => getBalance(db, k.id)));
  const childParam = Number(sp.child);
  return (
    <ApplyPanel
      kids={kids.map((k, i) => ({ id: k.id, name: k.name, avatar: k.avatar, balance: balances[i] }))}
      rules={rules.map((r) => ({ id: r.id, name: r.name, kind: r.kind, points: r.points }))}
      currency={currency.name}
      initialChildId={kids.some((k) => k.id === childParam) ? childParam : null}
      initialKind={sp.kind === "penalty" ? "penalty" : "reward"}
    />
  );
}

export default function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Apply searchParams={searchParams} />
    </Suspense>
  );
}
