import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Change polish-after-mvp task 2.2: con lọc lịch sử của mình theo loại và khoảng ngày
// (spec currency-ledger "Con lọc lịch sử của mình"), "Xem thêm" giữ bộ lọc, không lộ giao dịch của con khác.

type Seed = { child: string; kind: string; amount: number; description: string; at: string; count?: number };

/** Ghi thẳng giao dịch vào DB; trả về id của từng con theo tên. */
async function seed(familyName: string, rows: Seed[]): Promise<Record<string, number>> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const kids = await sql`
      select c.id, c.name, f.id as family_id, p.id as parent_id
      from children c join families f on f.id = c.family_id join parents p on p.family_id = f.id
      where f.name = ${familyName}`;
    const byName = Object.fromEntries(kids.map((k) => [k.name as string, k]));
    for (const r of rows) {
      const k = byName[r.child];
      for (let i = 1; i <= (r.count ?? 1); i++) {
        const description = r.count ? `${r.description} ${i}` : r.description;
        await sql`
          insert into transactions (family_id, child_id, kind, requested_amount, applied_amount, description, actor_parent_id, created_at)
          values (${k.family_id}, ${k.id}, ${r.kind}, ${r.amount}, ${r.amount}, ${description}, ${k.parent_id}, ${r.at})`;
      }
    }
    return Object.fromEntries(kids.map((k) => [k.name as string, Number(k.id)]));
  } finally {
    await sql.end();
  }
}

test("Con lọc lịch sử theo loại và khoảng ngày; Xem thêm giữ bộ lọc; không xem được của con khác", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  await setRandomClientIp(page);
  const familyName = `Nhà lọc lịch sử ${Date.now()}`;
  await registerFamily(page, { familyName, prefix: "kidhistory" });
  await addChild(page, "Bin", "1234", 1);
  await addChild(page, "Na", "5678", 2);
  // Múi giờ gia đình Asia/Ho_Chi_Minh (UTC+7): 2026-11-07T18:00Z đã là ngày 08/11.
  const ids = await seed(familyName, [
    { child: "Bin", kind: "redeem", amount: -2, description: "Đổi đầu tiên", at: "2026-11-01T00:30:00Z" },
    { child: "Bin", kind: "redeem", amount: -1, description: "Đổi trong khoảng", at: "2026-11-05T05:00:00Z", count: 55 },
    { child: "Bin", kind: "adhoc", amount: 3, description: "Thưởng trong khoảng", at: "2026-11-04T05:00:00Z" },
    { child: "Bin", kind: "redeem", amount: -2, description: "Đổi ngoài khoảng", at: "2026-11-07T18:00:00Z" },
    { child: "Bin", kind: "redeem", amount: -2, description: "Đổi trước khoảng", at: "2026-10-31T16:30:00Z" },
    { child: "Na", kind: "redeem", amount: -2, description: "Đổi của Na", at: "2026-11-03T05:00:00Z" },
  ]);

  await enableFamilyMode(page);
  await kidLogin(page, "Bin", "1234");
  await page.goto("/kid/history");
  await page.getByLabel("Loại").selectOption("redeem");
  await page.getByLabel("Từ ngày").fill("2026-11-01");
  await page.getByLabel("Đến ngày").fill("2026-11-07");
  await page.getByRole("button", { name: "Lọc" }).click();
  await expect(page).toHaveURL(/kind=redeem/);

  const rows = page.locator("main ol > li");
  await expect(rows).toHaveCount(50);
  await expect(page.getByLabel("Loại")).toHaveValue("redeem");
  await expect(page.getByLabel("Từ ngày")).toHaveValue("2026-11-01");
  await page.getByRole("link", { name: "Xem thêm" }).click();
  await expect(page).toHaveURL(/before=\d+/);
  await expect(page).toHaveURL(/kind=redeem/);
  await expect(page).toHaveURL(/from=2026-11-01/);
  await expect(page).toHaveURL(/to=2026-11-07/);
  await expect(rows).toHaveCount(6);
  await expect(rows.last()).toContainText("Đổi đầu tiên");
  const all = page.locator("main ol");
  for (const text of ["Thưởng trong khoảng", "Đổi ngoài khoảng", "Đổi trước khoảng", "Đổi của Na"]) await expect(all).not.toContainText(text);

  // Thêm child=<id con khác> trên URL không lộ giao dịch của Na.
  await page.goto(`/kid/history?child=${ids.Na}&kind=redeem&from=2026-11-03&to=2026-11-03`);
  await expect(page.getByText("Chưa có giao dịch nào.")).toBeVisible();
  await page.goto(`/kid/history?child=${ids.Na}`);
  await expect(all).not.toContainText("Đổi của Na");
  await expect(all).toContainText("Đổi ngoài khoảng");
});
