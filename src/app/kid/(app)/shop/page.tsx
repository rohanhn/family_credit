import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getShopView, listChildRedemptions, listRecentRejectedRedemptions } from "@/server/domain/shop";
import { rewardIcon } from "@/lib/reward-icons";
import { Icon } from "@/ui/icons";
import { Card, Chip, CoinIcon, ProgressBar } from "@/ui/primitives";
import { CancelRedemptionButton, GoalButton, RedeemButton } from "./shop-buttons";

export const metadata: Metadata = { title: "Cửa hàng · Sao nhà mình" };

async function KidShop() {
  const kid = await requireChild();
  const db = getDb();
  const [view, pending, recentRejected, currency] = await Promise.all([
    getShopView(db, kid.familyId, kid.childId),
    listChildRedemptions(db, kid.childId, "pending"),
    listRecentRejectedRedemptions(db, kid.childId),
    getCurrency(db, kid.familyId),
  ]);
  const { goal } = view;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-extrabold">Cửa hàng</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 font-display text-xl font-extrabold shadow-flat">
          <CoinIcon size={26} />
          {view.balance} {currency.name}
        </span>
      </div>

      {goal ? (
        <Card className="flex flex-col gap-2 border-2 border-primary">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="primary">Mục tiêu</Chip>
            <span className="flex-1 font-extrabold">{goal.name}</span>
            <GoalButton rewardId={null} label="Bỏ mục tiêu" />
          </div>
          <ProgressBar value={view.balance} max={goal.price} label={`Tiến độ mục tiêu ${goal.name}`} />
          <span className="text-sm font-bold text-muted">
            {Math.min(view.balance, goal.price)} / {goal.price} {currency.name} ·{" "}
            {goal.reached ? "Đủ điểm rồi, đổi thôi!" : `Còn ${goal.remaining} nữa`}
          </span>
        </Card>
      ) : (
        view.items.length > 0 && (
          <Card className="flex items-center gap-3 bg-soft">
            <span className="text-primary">
              <Icon name="goal" />
            </span>
            <span className="font-bold">Con chưa có mục tiêu. Chọn một phần thưởng bên dưới để để dành nhé!</span>
          </Card>
        )
      )}

      {pending.length > 0 && (
        <section aria-label="Đang chờ bố mẹ duyệt" className="flex flex-col gap-2">
          {pending.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center gap-3 bg-wait-bg text-wait-fg">
              <span className="flex-1 font-bold">
                <strong className="font-extrabold">{r.nameSnapshot}</strong> đang chờ bố mẹ duyệt. Điểm chưa bị trừ.
              </span>
              <CancelRedemptionButton redemptionId={r.id} label="Hủy yêu cầu" />
            </Card>
          ))}
        </section>
      )}

      {recentRejected.length > 0 && (
        <section aria-label="Bố mẹ chưa đồng ý" className="flex flex-col gap-2">
          {recentRejected.map((r) => (
            <Card key={r.id} className="flex flex-col gap-0.5">
              <span className="font-extrabold">Bố mẹ chưa đồng ý đổi “{r.nameSnapshot}”</span>
              <span className="text-sm font-semibold text-muted">{r.reason ? `Lý do: ${r.reason}` : "Bố mẹ không ghi lý do."}</span>
            </Card>
          ))}
        </section>
      )}

      {view.items.length === 0 ? (
        <Card className="p-6 text-center font-bold text-muted">Cửa hàng chưa có phần thưởng nào. Nhờ bố mẹ thêm nhé!</Card>
      ) : (
        <section aria-label="Phần thưởng" className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
          {view.items.map((r) => (
            <Card key={r.id} className={`flex flex-col gap-3 border-2 ${r.isGoal ? "border-primary" : "border-transparent"}`}>
              <div className="flex items-start gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-soft text-primary">
                  <Icon name={rewardIcon(r.icon)} size={26} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {r.isGoal && <Chip tone="primary">Mục tiêu</Chip>}
                  <span className="text-[17px] font-extrabold">{r.name}</span>
                  <span className="font-bold text-muted">
                    {r.price} {currency.name}
                  </span>
                  {r.description && <span className="text-sm font-semibold text-muted">{r.description}</span>}
                </span>
              </div>
              {r.pendingRedemptionId !== null ? (
                <Chip tone="wait" className="text-sm">
                  Chờ duyệt
                </Chip>
              ) : r.canRedeem ? (
                <RedeemButton rewardId={r.id} highlight={r.isGoal} />
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ProgressBar value={view.balance} max={r.price} label={`Tiến độ ${r.name}`} size="sm" />
                  <span className="text-sm font-extrabold text-muted">Còn thiếu {r.missing}</span>
                </div>
              )}
              {!r.isGoal && <GoalButton rewardId={r.id} label="Chọn làm mục tiêu" />}
            </Card>
          ))}
        </section>
      )}
    </>
  );
}

export default function KidShopPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidShop />
    </Suspense>
  );
}
