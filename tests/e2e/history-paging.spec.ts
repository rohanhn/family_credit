import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { addChild, registerFamily, setRandomClientIp } from "./helpers";

// Change fix-review-low-findings task 2.2: phân trang lịch sử (spec currency-ledger "Lịch sử dài hơn một trang")
// và tên đơn vị tiền tệ hiện trên từng dòng.

/** Ghi thẳng `count` giao dịch thưởng đột xuất cho con `childName` của gia đình `familyName`. */
async function seedTransactions(familyName: string, childName: string, count: number): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`
      select c.id as child_id, f.id as family_id, p.id as parent_id
      from children c join families f on f.id = c.family_id join parents p on p.family_id = f.id
      where f.name = ${familyName} and c.name = ${childName} limit 1`;
    for (let i = 1; i <= count; i++) {
      await sql`
        insert into transactions (family_id, child_id, kind, requested_amount, applied_amount, description, actor_parent_id)
        values (${row.family_id}, ${row.child_id}, 'adhoc', 1, 1, ${`Thưởng số ${i}`}, ${row.parent_id})`;
    }
  } finally {
    await sql.end();
  }
}

test("Lịch sử hơn 50 giao dịch có Xem thêm, giữ bộ lọc; đổi tên đơn vị thì dòng cũ hiện tên mới", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  await setRandomClientIp(page);
  const familyName = `Nhà lịch sử ${Date.now()}`;
  await registerFamily(page, { familyName, prefix: "history" });
  await addChild(page, "Bin", "1234", 1);
  await seedTransactions(familyName, "Bin", 60);

  await page.goto("/parent/history?kind=adhoc");
  const rows = page.locator("ol > li");
  await expect(rows).toHaveCount(50);
  await expect(rows.first()).toContainText("Thưởng số 60");
  await page.getByRole("link", { name: "Xem thêm" }).click();
  await expect(page).toHaveURL(/kind=adhoc/);
  await expect(page).toHaveURL(/before=\d+/);
  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText("Thưởng số 10");
  await expect(rows.last()).toContainText("Thưởng số 1");
  await expect(page.getByRole("link", { name: "Xem thêm" })).toHaveCount(0);

  // Tên đơn vị hiện trên từng dòng (không chỉ trong sr-only), theo tên hiện tại.
  await expect(rows.first()).toContainText(/\+1\s*Sao/);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update families set currency_name = 'Kim cương' where name = ${familyName}`;
  } finally {
    await sql.end();
  }
  await page.reload();
  await expect(rows.first()).toContainText(/\+1\s*Kim cương/);
});
