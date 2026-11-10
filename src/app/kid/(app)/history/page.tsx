import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { listTransactions } from "@/server/domain/ledger";
import { HistoryFilters, HistoryList, HistoryPager, historyPagerParams, historyQuery, parseHistoryParams } from "@/ui/history-list";

export const metadata: Metadata = { title: "Lịch sử · Sao nhà mình" };

// Con chỉ thấy giao dịch của chính mình (spec currency-ledger "Con xem lịch sử của mình"): luôn lọc theo
// con của phiên, bỏ qua tham số `child` trên URL (design D3 của change polish-after-mvp).
type SearchParams = Promise<{ kind?: string; from?: string; to?: string; before?: string }>;

async function KidHistory({ searchParams }: { searchParams: SearchParams }) {
  const kid = await requireChild();
  const sp = await searchParams;
  const p = parseHistoryParams(sp);
  const db = getDb();
  const [family, currency] = await Promise.all([getFamily(db, kid.familyId), getCurrency(db, kid.familyId)]);
  const { rows, nextBeforeId } = await listTransactions(db, { familyId: kid.familyId, ...historyQuery(p, family.timezone), childId: kid.childId });
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold">Lịch sử của con</h1>
      <HistoryFilters params={p} />
      <HistoryList rows={rows} timezone={family.timezone} currency={currency.name} />
      <HistoryPager basePath="/kid/history" params={historyPagerParams(p)} nextBeforeId={nextBeforeId} isFirstPage={p.before === undefined} />
    </>
  );
}

export default function KidHistoryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidHistory searchParams={searchParams} />
    </Suspense>
  );
}
