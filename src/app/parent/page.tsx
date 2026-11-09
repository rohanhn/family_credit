import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { getBalance, listTransactions } from "@/server/domain/ledger";
import { ChibiAvatar } from "@/ui/chibi";
import { HistoryList } from "@/ui/history-list";
import { ParentColumns } from "@/ui/parent-shell";
import { ButtonLink, Card } from "@/ui/primitives";
import { ApprovalQueue, loadQueue } from "./approval-queue";

export const metadata: Metadata = { title: "Tổng quan · Sao nhà mình" };

async function Overview() {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const [family, kids, currency] = await Promise.all([getFamily(db, auth.familyId), listChildren(db, auth.familyId), getCurrency(db, auth.familyId)]);

  if (kids.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 p-6">
        <h1 className="font-display text-2xl font-extrabold">Chào {auth.displayName}!</h1>
        <p className="font-semibold text-muted">Gia đình chưa có hồ sơ con nào. Thêm con để bắt đầu thưởng, phạt và giao nhiệm vụ.</p>
        <ButtonLink href="/parent/settings#con">Thêm con</ButtonLink>
      </Card>
    );
  }

  const [balances, queue, recent] = await Promise.all([
    Promise.all(kids.map((k) => getBalance(db, k.id))),
    loadQueue(db, auth.familyId, family.timezone),
    listTransactions(db, { familyId: auth.familyId, limit: 6 }),
  ]);

  return (
    <>
      <h1 className="sr-only">Tổng quan</h1>
      <section aria-label="Các con" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {kids.map((k, i) => (
          <Card key={k.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ChibiAvatar avatar={k.avatar} size={56} />
              <span className="flex-1 text-lg font-extrabold">{k.name}</span>
              <span className="text-right">
                <span className="block font-display text-[28px] font-extrabold leading-none text-primary">{balances[i]}</span>
                <span className="text-xs font-bold text-muted">{currency.name}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href={`/parent/apply?child=${k.id}&kind=reward`} variant="reward">
                + Thưởng
              </ButtonLink>
              <ButtonLink href={`/parent/apply?child=${k.id}&kind=penalty`} variant="penalty">
                − Phạt
              </ButtonLink>
            </div>
          </Card>
        ))}
      </section>
      <ParentColumns
        main={<ApprovalQueue items={queue} />}
        aside={
          <>
            <h2 className="font-display text-2xl font-extrabold">Gần đây</h2>
            <HistoryList rows={recent} timezone={family.timezone} currency={currency.name} showChild />
            <Link href="/parent/history" className="font-extrabold text-primary underline">
              Xem toàn bộ lịch sử
            </Link>
          </>
        }
      />
    </>
  );
}

export default function ParentHome() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Overview />
    </Suspense>
  );
}
