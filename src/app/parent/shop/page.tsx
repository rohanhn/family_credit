import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getCurrency } from "@/server/domain/currency";
import { listRewards } from "@/server/domain/shop";
import { ParentColumns } from "@/ui/parent-shell";
import { Card } from "@/ui/primitives";
import { NewRewardForm, RewardRow } from "./reward-forms";

export const metadata: Metadata = { title: "Cửa hàng · Sao nhà mình" };

async function Shop() {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const [rewards, kids, currency] = await Promise.all([
    listRewards(db, auth.familyId, { includeHidden: true }),
    listChildren(db, auth.familyId),
    getCurrency(db, auth.familyId),
  ]);
  const visible = rewards.filter((r) => !r.hidden);
  const hidden = rewards.filter((r) => r.hidden);
  const row = (r: (typeof rewards)[number]) => (
    <RewardRow
      key={r.id}
      currencyName={currency.name}
      reward={{
        id: r.id,
        name: r.name,
        price: r.price,
        icon: r.icon,
        description: r.description,
        hidden: r.hidden,
        goalOf: kids.filter((k) => k.goalRewardId === r.id).map((k) => k.name),
      }}
    />
  );
  return (
    <ParentColumns
      main={
        <>
          <h1 className="font-display text-3xl font-extrabold">Cửa hàng đổi thưởng</h1>
          <p className="font-semibold text-muted">Yêu cầu đổi thưởng của các con nằm trong hàng chờ duyệt ở trang Tổng quan.</p>
          {/* Một danh sách duy nhất (đang ẩn xếp cuối) để dòng giữ trạng thái và thông báo khi ẩn/hiện. */}
          <section className="flex flex-col gap-2.5" aria-label="Phần thưởng">
            {rewards.length === 0 ? <p className="font-semibold text-muted">Chưa có phần thưởng nào.</p> : [...visible, ...hidden].map(row)}
          </section>
        </>
      }
      aside={
        <Card>
          <NewRewardForm />
        </Card>
      }
    />
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Shop />
    </Suspense>
  );
}
