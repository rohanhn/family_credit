import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getBalance } from "@/server/domain/ledger";
import { CoinIcon } from "@/ui/primitives";

export const metadata: Metadata = { title: "Trang chính · Sao nhà mình" };

// Bản tối thiểu cho task 3.6; nội dung đầy đủ (mục tiêu, nhiệm vụ hôm nay, ăn mừng) ở task 7.3.
async function KidHome() {
  const kid = await requireChild();
  const db = getDb();
  const [balance, currency] = await Promise.all([getBalance(db, kid.childId), getCurrency(db, kid.familyId)]);
  return (
    <div className="flex min-h-36 items-center gap-4 rounded-[28px] bg-primary px-6 py-5 text-on-primary">
      <CoinIcon size={64} />
      <span className="flex flex-col">
        <span className="font-bold opacity-90">Con đang có</span>
        <span className="font-display text-[52px] font-extrabold leading-none">
          {balance} <span className="text-2xl">{currency.name}</span>
        </span>
      </span>
    </div>
  );
}

export default function KidHomePage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidHome />
    </Suspense>
  );
}
