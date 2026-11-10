import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { listTransactions } from "@/server/domain/ledger";
import { HistoryList, HistoryPager } from "@/ui/history-list";

export const metadata: Metadata = { title: "Lịch sử · Sao nhà mình" };

// Con chỉ thấy giao dịch của chính mình (spec currency-ledger "Con xem lịch sử của mình").
type SearchParams = Promise<{ before?: string }>;

async function KidHistory({ searchParams }: { searchParams: SearchParams }) {
  const kid = await requireChild();
  const sp = await searchParams;
  const before = /^[1-9]\d{0,9}$/.test(sp.before ?? "") ? Number(sp.before) : undefined;
  const db = getDb();
  const [family, currency, { rows, nextBeforeId }] = await Promise.all([
    getFamily(db, kid.familyId),
    getCurrency(db, kid.familyId),
    listTransactions(db, { familyId: kid.familyId, childId: kid.childId, beforeId: before }),
  ]);
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold">Lịch sử của con</h1>
      <HistoryList rows={rows} timezone={family.timezone} currency={currency.name} />
      <HistoryPager basePath="/kid/history" params={{}} nextBeforeId={nextBeforeId} isFirstPage={before === undefined} />
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
