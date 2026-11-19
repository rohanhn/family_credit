import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Change add-negative-balance-freeze task 8.1: phạt thành nợ → giao diện đóng băng, cửa hàng và yêu cầu
// đổi thưởng bị khóa → duyệt nhiệm vụ trả hết nợ → "Tan băng rồi!" và theme cũ trở lại.

const PIN = "1234";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  return postgres(url, { max: 1, onnotice: () => {} });
}

/** Cho Bin 5 điểm, phần thưởng "Kem" giá 5 cùng một yêu cầu đổi đang chờ, và cho nhiệm vụ có hiệu lực từ hôm nay. */
async function seed(familyName: string): Promise<void> {
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      const [row] = await tx`
        select c.id as child_id, f.id as family_id, p.id as parent_id
        from children c join families f on f.id = c.family_id join parents p on p.family_id = f.id
        where f.name = ${familyName} and c.name = 'Bin' limit 1`;
      await tx`
        insert into transactions (family_id, child_id, kind, requested_amount, applied_amount, description, actor_parent_id)
        values (${row.family_id}, ${row.child_id}, 'adhoc', 5, 5, 'Thưởng ban đầu', ${row.parent_id})`;
      const [reward] = await tx`insert into rewards (family_id, name, price, icon) values (${row.family_id}, 'Kem', 5, 'icecream') returning id`;
      await tx`insert into redemptions (child_id, reward_id, name_snapshot, price_snapshot) values (${row.child_id}, ${reward.id}, 'Kem', 5)`;
      await tx`update children set created_at = created_at - interval '2 days' where family_id = ${row.family_id}`;
      await tx`update task_assignees set effective_from = effective_from - 2 where task_id in (select id from tasks where family_id = ${row.family_id})`;
      await tx`update tasks set effective_from = effective_from - 2 where family_id = ${row.family_id}`;
      // Thông báo của khoản thưởng ban đầu không nằm trong kịch bản.
      await tx`update notifications set read_at = now() where child_id = ${row.child_id}`;
    });
  } finally {
    await sql.end();
  }
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/parent");
}

async function newPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setRandomClientIp(page);
  return page;
}

test("Phạt thành nợ: đóng băng, khóa cửa hàng và yêu cầu đổi thưởng, rồi tan băng", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Luồng dài, chỉ chạy một lần");
  test.setTimeout(240_000);
  const familyName = `Nhà đóng băng ${Date.now()}`;

  // --- Bố mẹ: gia đình, con, rule phạt 20, nhiệm vụ 20 ---
  const parent = await newPage(browser);
  const email = await registerFamily(parent, { familyName, prefix: "freeze" });
  await addChild(parent, "Bin", PIN, 1);

  await parent.goto("/parent/rules");
  await parent.getByLabel("Tên hành động").fill("Nói dối");
  await parent.getByLabel("Loại").selectOption("penalty");
  await parent.getByLabel("Số điểm", { exact: true }).fill("20");
  await parent.getByRole("button", { name: "Thêm rule" }).click();
  await expect(parent.getByText('Đã thêm rule "Nói dối"')).toBeVisible();

  await parent.goto("/parent/tasks");
  await parent.getByLabel("Tên nhiệm vụ").fill("Dọn phòng");
  await parent.getByLabel("Điểm", { exact: true }).fill("20");
  await parent.getByRole("button", { name: /^Lưu \(bắt đầu từ/ }).click();
  await expect(parent.getByText('Đã tạo "Dọn phòng", bắt đầu từ ngày mai')).toBeVisible();

  await seed(familyName);

  // --- Bố mẹ phạt 20 khi con có 5: thấy báo trước "sẽ nợ 15" nhưng vẫn ghi được ---
  await parent.goto("/parent/apply?kind=penalty");
  await parent.getByText("Nói dối", { exact: true }).click();
  await expect(parent.getByText("Sau khi phạt, Bin sẽ nợ 15 Sao")).toBeVisible();
  await parent.getByRole("button", { name: /^Phạt Bin −20/ }).click();
  await expect(parent.getByText("Đã ghi: Nói dối −20")).toBeVisible();
  await parent.goto("/parent");
  await expect(parent.getByRole("region", { name: "Các con" })).toContainText("đang nợ");

  // --- Con đăng nhập: màn bị trừ hiện số nợ, rồi màn chính đóng băng ---
  const kid = await newPage(browser);
  await login(kid, email);
  await enableFamilyMode(kid);
  await kidLogin(kid, "Bin", PIN);

  const penalty = kid.getByRole("dialog");
  await expect(penalty).toContainText("−20");
  await expect(penalty).toContainText("Con đang nợ 15 Sao");
  await penalty.getByRole("button", { name: "Con hiểu rồi" }).click();
  await expect(penalty).toBeHidden();

  const shell = kid.locator("[data-theme]").first();
  await expect(shell).toHaveAttribute("data-theme", "frozen");
  await expect(kid.getByText("Đang nợ", { exact: true })).toBeVisible();
  await expect(kid.getByText("Còn 15 nữa là tan băng")).toBeVisible();
  await expect(kid.getByText("Làm 1 nhiệm vụ hôm nay là tan băng rồi!")).toBeVisible();

  // --- Cửa hàng bị khóa, yêu cầu đang chờ bị đóng băng và không hủy được ---
  await kid.goto("/kid/shop");
  await expect(kid.getByText("Cửa hàng đang đóng băng")).toBeVisible();
  await expect(kid.getByText("Đang khóa")).toBeVisible();
  await expect(kid.getByText(/Kem\s*đang đóng băng/)).toBeVisible();
  await expect(kid.getByRole("button", { name: "Đổi", exact: true })).toHaveCount(0);
  await expect(kid.getByRole("button", { name: "Hủy yêu cầu" })).toHaveCount(0);

  // --- Hàng chờ của bố mẹ: yêu cầu đổi thưởng đóng băng, cả hai nút bị khóa ---
  await parent.goto("/parent");
  const redeemCard = parent.locator("div:has(> form)").filter({ hasText: "Bin · Kem" });
  await expect(redeemCard).toContainText("Đang đóng băng: con đang nợ 15");
  await expect(redeemCard.getByRole("button", { name: "Duyệt", exact: true })).toBeDisabled();
  await expect(redeemCard.getByRole("button", { name: "Từ chối", exact: true })).toBeDisabled();

  // --- Con báo xong nhiệm vụ, bố mẹ duyệt +20 → tan băng ---
  await kid.goto("/kid/home");
  const taskCard = kid.locator("section[aria-labelledby=today-title] div", { hasText: "Dọn phòng" }).filter({ has: kid.getByRole("button") }).last();
  await taskCard.getByRole("button", { name: "Con xong rồi" }).click();
  await expect(taskCard.getByText("Chờ duyệt")).toBeVisible();

  await parent.goto("/parent");
  const taskQueue = parent.locator("div:has(> form)", { has: parent.getByRole("button", { name: "Duyệt", exact: true }) }).filter({ hasText: "Bin · Dọn phòng" });
  await taskQueue.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(parent.getByRole("listitem").filter({ hasText: "Dọn phòng" }).first()).toContainText("+20");

  await kid.goto("/kid/home");
  const thaw = kid.getByRole("dialog");
  await expect(thaw).toContainText("Tan băng rồi!");
  await expect(thaw).toContainText("+20");
  await thaw.getByRole("button", { name: "Nhận quà" }).click();
  await expect(thaw).toBeHidden();
  await expect(shell).toHaveAttribute("data-theme", "sunny");
  await expect(kid.getByText("Con đang có")).toBeVisible();

  // Hết nợ: yêu cầu đang chờ lại xử lý được.
  await parent.goto("/parent");
  await expect(redeemCard.getByRole("button", { name: "Duyệt", exact: true })).toBeEnabled();
});
