import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { listTransactions } from "@/server/domain/ledger";
import { HistoryFilters, HistoryList, HistoryPager, historyPagerParams, historyQuery, parseHistoryParams } from "@/ui/history-list";
import { AdjustButton } from "./adjust-button";

export const metadata: Metadata = { title: "Lịch sử · Sao nhà mình" };

type SearchParams = Promise<{ child?: string; kind?: string; from?: string; to?: string; before?: string }>;

async function History({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireParentWithFamily();
  const sp = await searchParams;
  const db = getDb();
  const [family, kids, currency] = await Promise.all([getFamily(db, auth.familyId), listChildren(db, auth.familyId, { includeArchived: true }), getCurrency(db, auth.familyId)]);

  const p = parseHistoryParams(sp, { childIds: kids.map((k) => k.id) });
  const { rows, nextBeforeId } = await listTransactions(db, { familyId: auth.familyId, childId: p.childId, ...historyQuery(p, family.timezone) });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-extrabold">Lịch sử</h1>
      <HistoryFilters params={p} showChild kids={kids} />
      <HistoryList
        rows={rows}
        timezone={family.timezone}
        currency={currency.name}
        showChild
        rowAction={(r) => (r.kind !== "adjust" && !r.adjusted && r.appliedAmount !== 0 ? <AdjustButton transactionId={r.id} /> : null)}
      />
      <HistoryPager
        basePath="/parent/history"
        params={historyPagerParams(p)}
        nextBeforeId={nextBeforeId}
        isFirstPage={p.before === undefined}
      />
    </div>
  );
}

export default function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <History searchParams={searchParams} />
    </Suspense>
  );
}
