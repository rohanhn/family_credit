import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getChildToday } from "@/server/domain/daily-tasks";
import { getFamily } from "@/server/domain/families";
import { getShopView } from "@/server/domain/shop";
import { rewardIcon } from "@/lib/reward-icons";
import { Mascot } from "@/ui/chibi";
import { CurrencyIcon } from "@/ui/currency-icon";
import { Icon } from "@/ui/icons";
import { Card, Chip, ProgressBar } from "@/ui/primitives";
import { effectiveTheme, THEMES } from "@/ui/themes";
import { RedeemButton } from "../shop/shop-buttons";
import { TodayTasks } from "./today-tasks";

export const metadata: Metadata = { title: "Trang chính · Sao nhà mình" };

// Màn hình chính của con (mockup Main / WebKidHome, spec ui-theme "Màn hình chính của con"):
// số dư kèm đơn vị tiền tệ (và linh vật của theme), mục tiêu cùng tiến độ, nhiệm vụ hôm nay.
// Màn thông báo điểm mới nằm trong layout khu vực con.
async function KidHome() {
  const kid = await requireChild();
  const db = getDb();
  const [family, currency, shop, today] = await Promise.all([
    getFamily(db, kid.familyId),
    getCurrency(db, kid.familyId),
    getShopView(db, kid.familyId, kid.childId),
    getChildToday(db, kid.familyId, kid.childId),
  ]);
  const mascot = THEMES[effectiveTheme(kid.theme, family.defaultTheme)].mascot;
  const { balance, goal } = shop;
  return (
    <>
      <h1 className="hidden font-display text-4xl font-extrabold leading-tight md:block">Chào {kid.name}! Hôm nay mình cố lên nhé</h1>
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <div className="relative flex min-h-36 items-center gap-4 overflow-hidden rounded-[28px] bg-primary px-5 py-5 text-on-primary md:px-6">
          <CurrencyIcon icon={currency.icon} size={64} />
          <span className="relative z-10 flex flex-col">
            <span className="font-bold">Con đang có</span>
            <span className="font-display text-[52px] font-extrabold leading-none md:text-6xl">
              {balance} <span className="text-2xl md:text-[26px]">{currency.name}</span>
            </span>
          </span>
          <span className="absolute -right-5 -top-5 size-[90px] rounded-full bg-white/12" aria-hidden="true" />
          {mascot && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Mascot kind={mascot} size={84} onDark />
            </span>
          )}
        </div>

        {goal ? (
          <Card className="flex flex-col justify-center gap-2.5 md:gap-3 md:rounded-[28px] md:px-5">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-soft text-primary">
                <Icon name={rewardIcon(goal.icon)} size={28} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-extrabold uppercase text-muted">Mục tiêu của con</span>
                <span className="truncate text-lg font-extrabold md:text-xl">{goal.name}</span>
              </span>
              <span className="font-display text-[22px] font-extrabold text-primary md:text-[28px]">{goal.percent}%</span>
            </div>
            <ProgressBar value={balance} max={goal.price} label={`Tiến độ mục tiêu ${goal.name}`} />
            <span className="text-sm font-bold text-muted md:text-[15px]">
              {Math.min(balance, goal.price)} / {goal.price} {currency.name} · {goal.reached ? "Đủ rồi, đổi quà thôi!" : `Còn ${goal.remaining} nữa`}
            </span>
            {goal.reached &&
              (goal.pendingRedemptionId !== null ? (
                <Chip tone="wait" className="!px-3 !py-2 text-sm">
                  Chờ duyệt
                </Chip>
              ) : (
                <RedeemButton rewardId={goal.id} highlight />
              ))}
          </Card>
        ) : (
          <Link href="/kid/shop" className="no-underline">
            <Card className="flex h-full items-center gap-3 md:rounded-[28px]">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-soft text-primary">
                <Icon name="goal" size={28} />
              </span>
              <span className="flex flex-col">
                <span className="font-extrabold">Con chưa có mục tiêu</span>
                <span className="text-sm font-bold text-muted">Vào Cửa hàng chọn một phần thưởng để để dành nhé</span>
              </span>
            </Card>
          </Link>
        )}
      </div>
      <TodayTasks items={today.items} childId={kid.childId} currency={currency.name} />
    </>
  );
}

export default function KidHomePage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidHome />
    </Suspense>
  );
}
