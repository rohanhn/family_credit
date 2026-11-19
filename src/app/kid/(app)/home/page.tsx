import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getChildToday } from "@/server/domain/daily-tasks";
import { getFamily } from "@/server/domain/families";
import { getDebtInfo } from "@/server/domain/ledger";
import { getShopView } from "@/server/domain/shop";
import { debtOf, encouragementFor, isInDebt, tasksToThaw, thawProgress } from "@/lib/debt";
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
  const { balance, goal } = shop;
  const inDebt = isInDebt(balance);
  // Linh vật thuộc theme con chọn nên ẩn khi đóng băng (design D4).
  const mascot = inDebt ? undefined : THEMES[effectiveTheme(kid.theme, family.defaultTheme)].mascot;
  return (
    <>
      <h1 className="hidden font-display text-4xl font-extrabold leading-tight md:block">Chào {kid.name}! Hôm nay mình cố lên nhé</h1>
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <div className="relative flex min-h-36 items-center gap-4 overflow-hidden rounded-[28px] bg-primary px-5 py-5 text-on-primary md:px-6">
          <CurrencyIcon icon={currency.icon} size={64} />
          <span className="relative z-10 flex flex-col">
            <span className="font-bold">{inDebt ? "Đang nợ" : "Con đang có"}</span>
            <span className="font-display text-[52px] font-extrabold leading-none md:text-6xl">
              {inDebt ? debtOf(balance) : balance} <span className="text-2xl md:text-[26px]">{currency.name}</span>
            </span>
          </span>
          <span className="absolute -right-5 -top-5 size-[90px] rounded-full bg-white/12" aria-hidden="true" />
          {mascot && (
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <Mascot kind={mascot} size={84} onDark />
            </span>
          )}
        </div>

        {inDebt ? (
          <ThawCard childId={kid.childId} balance={balance} currency={currency.name} />
        ) : goal ? (
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
      {inDebt && (
        <EncouragementCard
          debt={debtOf(balance)}
          date={today.date}
          openTasks={today.items.filter((i) => i.status === "todo").map((i) => ({ key: i.key, name: i.name, points: i.points }))}
          currency={currency.name}
        />
      )}
      <TodayTasks items={today.items} childId={kid.childId} currency={currency.name} />
    </>
  );
}

/** Thanh tan băng thay cho thẻ mục tiêu khi con đang nợ (spec debt-freeze "Thanh tan băng"). */
async function ThawCard({ childId, balance, currency }: { childId: number; balance: number; currency: string }) {
  const { peakDebt } = await getDebtInfo(getDb(), childId);
  const { percent, remaining } = thawProgress(balance, peakDebt);
  const peak = Math.max(peakDebt, remaining);
  return (
    <Card className="flex flex-col justify-center gap-2.5 md:gap-3 md:rounded-[28px] md:px-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-soft text-primary" aria-hidden="true">
          <Icon name="snow" size={28} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-extrabold uppercase text-muted">Tan băng</span>
          <span className="truncate text-lg font-extrabold md:text-xl">Kiếm {currency} để tan băng</span>
        </span>
        <span className="font-display text-[22px] font-extrabold text-primary md:text-[28px]">{percent}%</span>
      </div>
      <ProgressBar value={peak - remaining} max={peak} label="Tiến độ tan băng" />
      <span className="text-sm font-bold text-muted md:text-[15px]">Còn {remaining} nữa là tan băng</span>
    </Card>
  );
}

/** Lời động viên và lối tắt kiếm điểm khi đang nợ (spec debt-freeze "Động viên và lối tắt kiếm điểm"). */
function EncouragementCard({
  debt,
  date,
  openTasks,
  currency,
}: {
  debt: number;
  date: string;
  openTasks: { key: string; name: string; points: number }[];
  currency: string;
}) {
  const needed = tasksToThaw(
    debt,
    openTasks.map((t) => t.points),
  );
  // Đủ trả nợ: chỉ nêu các nhiệm vụ cần làm (nhiều điểm trước); không đủ: nêu mọi nhiệm vụ còn làm được.
  const shown = needed === null ? openTasks : [...openTasks].sort((a, b) => b.points - a.points).slice(0, needed);
  return (
    <section aria-labelledby="cheer-title" className="flex flex-col gap-3 rounded-[28px] bg-card p-5 shadow-flat">
      <h2 id="cheer-title" className="font-display text-[22px] font-extrabold leading-tight">
        {encouragementFor(date, needed)}
      </h2>
      <div className="flex flex-wrap gap-2">
        {shown.map((t) => (
          <a key={t.key} href="#today-title" className="flex min-h-11 items-center gap-1.5 rounded-[14px] bg-soft px-3.5 font-extrabold text-ink no-underline">
            <Icon name="check" size={18} />
            {t.name} · +{t.points} {currency}
          </a>
        ))}
        <Link href="/kid/rules#rule-thuong" className="flex min-h-11 items-center gap-1.5 rounded-[14px] bg-soft px-3.5 font-extrabold text-ink no-underline">
          <Icon name="list" size={18} />
          Khai rule thưởng
        </Link>
        <Link href="/kid/rules#de-xuat" className="flex min-h-11 items-center gap-1.5 rounded-[14px] bg-soft px-3.5 font-extrabold text-ink no-underline">
          <Icon name="gift" size={18} />
          Xin thưởng việc tốt
        </Link>
      </div>
    </section>
  );
}

export default function KidHomePage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidHome />
    </Suspense>
  );
}
