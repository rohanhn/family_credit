import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Change fix-review-low-findings task 4.2: màn chính của con có nút "Đổi" nổi bật khi đạt mục tiêu.

/** Tạo phần thưởng giá `price`, đặt làm mục tiêu của con và cộng đủ điểm. */
async function seedGoal(familyName: string, childName: string, price: number): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`
      select c.id as child_id, f.id as family_id, p.id as parent_id
      from children c join families f on f.id = c.family_id join parents p on p.family_id = f.id
      where f.name = ${familyName} and c.name = ${childName} limit 1`;
    const [reward] = await sql`insert into rewards (family_id, name, price, icon) values (${row.family_id}, 'Đi xem phim', ${price}, 'gift') returning id`;
    await sql`update children set goal_reward_id = ${reward.id} where id = ${row.child_id}`;
    await sql`
      insert into transactions (family_id, child_id, kind, requested_amount, applied_amount, description, actor_parent_id)
      values (${row.family_id}, ${row.child_id}, 'adhoc', ${price}, ${price}, 'Thưởng', ${row.parent_id})`;
  } finally {
    await sql.end();
  }
}

test("Đạt mục tiêu: màn chính có nút Đổi; gửi xong thì hiện Chờ duyệt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  await setRandomClientIp(page);
  const familyName = `Nhà mục tiêu ${Date.now()}`;
  await registerFamily(page, { familyName, prefix: "goal" });
  await addChild(page, "Bin", "1234", 1);
  await seedGoal(familyName, "Bin", 20);
  await page.goto("/parent");
  await enableFamilyMode(page);
  await kidLogin(page, "Bin", "1234");
  // Đóng màn ăn mừng của khoản thưởng vừa ghi (nếu có).
  const close = page.getByRole("button", { name: /Tuyệt|Con hiểu rồi|Đóng/ });
  if (await close.first().isVisible().catch(() => false)) await close.first().click();

  const goalCard = page.locator("div", { hasText: "Mục tiêu của con" }).filter({ has: page.getByRole("progressbar") }).last();
  await expect(goalCard.getByText("100%")).toBeVisible();
  await goalCard.getByRole("button", { name: "Đổi" }).click();
  await expect(goalCard.getByText("Chờ duyệt")).toBeVisible();
  await expect(goalCard.getByRole("button", { name: "Đổi" })).toHaveCount(0);
});
