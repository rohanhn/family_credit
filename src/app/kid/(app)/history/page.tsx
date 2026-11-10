import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { listTransactions } from "@/server/domain/ledger";
import { HistoryList } from "@/ui/history-list";

export const metadata: Metadata = { title: "Lịch sử · Sao nhà mình" };

// Con chỉ thấy giao dịch của chính mình (spec currency-ledger "Con xem lịch sử của mình").
async function KidHistory() {
  const kid = await requireChild();
  const db = getDb();
  const [family, currency, { rows }] = await Promise.all([
    getFamily(db, kid.familyId),
    getCurrency(db, kid.familyId),
    listTransactions(db, { familyId: kid.familyId, childId: kid.childId }),
  ]);
  return (
    <>
      <h1 className="font-display text-[28px] font-extrabold">Lịch sử của con</h1>
      <HistoryList rows={rows} timezone={family.timezone} currency={currency.name} />
    </>
  );
}

export default function KidHistoryPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidHistory />
    </Suspense>
  );
}
