import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Task 8.1: luồng chính từ bố mẹ đăng ký tới con đổi thưởng (design D7).
// Bố mẹ và thiết bị chế độ gia đình là hai browser context riêng, như hai máy thật.
//
// Nhiệm vụ mới chỉ có hiệu lực từ ngày mai (design D3 "Phiên bản nhiệm vụ") và "Tất cả các con" chỉ gồm
// con có hồ sơ từ trước ngày đó. Để con làm được ngay trong test, sau khi tạo qua giao diện ta lùi
// `effective_from` của nhiệm vụ và `created_at` của các con về hai ngày trước, trực tiếp trong DB.

const PIN_BIN = "1234";
const PIN_NA = "5678";

async function backdateFamily(familyName: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e (đặt trong .env hoặc biến môi trường)");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const [family] = await tx`select id from families where name = ${familyName} order by id desc limit 1`;
      if (!family) throw new Error(`Không thấy gia đình ${familyName}`);
      await tx`update children set created_at = created_at - interval '2 days' where family_id = ${family.id}`;
      await tx`update task_assignees set effective_from = effective_from - 2
               where task_id in (select id from tasks where family_id = ${family.id})`;
      await tx`update tasks set effective_from = effective_from - 2 where family_id = ${family.id}`;
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

/** Thẻ trong hàng chờ duyệt của bố mẹ (form Duyệt là con trực tiếp của thẻ) có chứa đoạn chữ `text`. */
function queueCard(page: Page, text: string): Locator {
  return page.locator("div:has(> form)", { has: page.getByRole("button", { name: "Duyệt", exact: true }) }).filter({ hasText: text });
}

/** Bố mẹ duyệt một mục trong hàng chờ; mục biến khỏi hàng chờ và hiện trong giao dịch gần đây. */
async function approve(page: Page, text: string, amount: string, historyText = text): Promise<void> {
  await page.goto("/parent");
  const card = queueCard(page, text);
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: historyText }).first()).toContainText(amount);
}

test("Luồng chính: đăng ký → nhiệm vụ, rule, đổi thưởng → duyệt → thông báo và lịch sử", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Luồng dài, chỉ chạy một lần");
  test.setTimeout(240_000);
  const familyName = `Nhà Bin & Na ${Date.now()}`;

  // --- Bố mẹ: đăng ký, tạo gia đình, hai con, rule, nhiệm vụ, phần thưởng ---
  const parent = await newPage(browser);
  const email = await registerFamily(parent, { familyName, displayName: "Mẹ", prefix: "main" });
  await addChild(parent, "Bin", PIN_BIN, 1);
  await addChild(parent, "Na", PIN_NA, 4);

  await parent.goto("/parent/rules");
  await parent.getByLabel("Tên hành động").fill("Đọc sách 15 phút");
  await parent.getByLabel("Loại").selectOption("reward");
  await parent.getByLabel("Số điểm", { exact: true }).fill("4");
  await parent.getByRole("button", { name: "Thêm rule" }).click();
  await expect(parent.getByText('Đã thêm rule "Đọc sách 15 phút"')).toBeVisible();

  await parent.goto("/parent/tasks");
  // Nhiệm vụ riêng cho Bin.
  await parent.getByLabel("Tên nhiệm vụ").fill("Đánh răng tối");
  await parent.getByLabel("Điểm", { exact: true }).fill("5");
  await parent.getByRole("button", { name: "Tất cả các con" }).click();
  await parent.getByRole("checkbox", { name: "Bin", exact: true }).check({ force: true });
  await parent.getByRole("button", { name: /^Lưu \(bắt đầu từ/ }).click();
  await expect(parent.getByText('Đã tạo "Đánh răng tối", bắt đầu từ ngày mai')).toBeVisible();
  // Nhiệm vụ nhóm cho "Tất cả các con".
  await parent.getByLabel("Tên nhiệm vụ").fill("Dọn phòng chơi");
  await parent.getByLabel("Điểm", { exact: true }).fill("3");
  await expect(parent.getByRole("button", { name: "Tất cả các con" })).toHaveAttribute("aria-pressed", "true");
  await parent.getByRole("radio", { name: /Cả nhóm làm chung/ }).check({ force: true });
  await parent.getByRole("button", { name: /^Lưu \(bắt đầu từ/ }).click();
  await expect(parent.getByText('Đã tạo "Dọn phòng chơi", bắt đầu từ ngày mai')).toBeVisible();

  await parent.goto("/parent/shop");
  await parent.getByLabel("Tên phần thưởng").fill("Ăn kem cuối tuần");
  await parent.getByLabel("Giá", { exact: true }).fill("10");
  await parent.getByRole("button", { name: "Thêm phần thưởng" }).click();
  await expect(parent.getByText('Đã thêm "Ăn kem cuối tuần"')).toBeVisible();

  await backdateFamily(familyName);

  // --- Thiết bị của con: bố mẹ đăng nhập, bật chế độ gia đình, Bin đăng nhập PIN ---
  const kid = await newPage(browser);
  await login(kid, email);
  await enableFamilyMode(kid);
  await kidLogin(kid, "Bin", PIN_BIN);

  const tasks = kid.getByRole("region", { name: "Nhiệm vụ hôm nay" }).or(kid.locator("section[aria-labelledby=today-title]"));
  const brushCard = tasks.locator("div", { hasText: "Đánh răng tối" }).filter({ has: kid.getByRole("button") }).last();
  await brushCard.getByRole("button", { name: "Con xong rồi" }).click();
  await expect(brushCard.getByText("Chờ duyệt")).toBeVisible();
  const groupCard = tasks.locator("div", { hasText: "Dọn phòng chơi" }).filter({ has: kid.getByRole("button") }).last();
  await expect(groupCard.getByText(/Nhiệm vụ nhóm · Bin, Na|Nhiệm vụ nhóm · Na, Bin/)).toBeVisible();
  await groupCard.getByRole("button", { name: "Xong rồi" }).click();
  await expect(groupCard.getByText("Chờ duyệt")).toBeVisible();

  // --- Con khai rule thưởng (trước khi bố mẹ duyệt, để một màn nhận quà gom đủ ba khoản) ---
  await kid.goto("/kid/rules");
  await kid.getByRole("button", { name: "Con đã làm" }).click();
  await kid.getByLabel(/Ghi chú cho bố mẹ/).fill("Truyện cổ tích");
  await kid.getByRole("button", { name: "Gửi bố mẹ duyệt" }).click();
  await expect(kid.getByText('Đã gửi "Đọc sách 15 phút" cho bố mẹ duyệt')).toBeVisible();

  // --- Bố mẹ duyệt hai nhiệm vụ (nhiệm vụ nhóm cộng cho cả hai con) và khai rule ---
  await approve(parent, "Bin · Đánh răng tối", "+5");
  await approve(parent, "Dọn phòng chơi", "+3");
  await approve(parent, "Bin · Đọc sách 15 phút", "+4");

  // --- Con thấy chuông có 3 thông báo chưa đọc và màn nhận quà liệt kê từng khoản ---
  await kid.goto("/kid/home");
  await expect(kid.locator('button[aria-label="Thông báo, 3 chưa đọc"]').filter({ visible: true })).toHaveCount(1);
  const celebrate = kid.getByRole("dialog");
  await expect(celebrate).toContainText("Giỏi quá, Bin ơi!");
  await expect(celebrate).toContainText("+12");
  for (const title of ["Đánh răng tối", "Dọn phòng chơi", "Đọc sách 15 phút"]) await expect(celebrate).toContainText(title);
  await celebrate.getByRole("button", { name: "Nhận quà" }).click();
  await expect(celebrate).toBeHidden();
  await expect(kid.locator('button[aria-label="Thông báo"]').filter({ visible: true })).toHaveCount(1);

  // --- Con đổi thưởng, bố mẹ duyệt, con nhận thông báo "nhận quà" ---
  await kid.goto("/kid/shop");
  await expect(kid.getByText("12 Sao").first()).toBeVisible();
  await kid.getByRole("button", { name: "Đổi", exact: true }).click();
  await expect(kid.getByText("đang chờ bố mẹ duyệt")).toBeVisible();
  await approve(parent, "Bin · Ăn kem cuối tuần", "−10", "Bin · Đổi thưởng: Ăn kem cuối tuần");

  await kid.goto("/kid/home");
  const gift = kid.getByRole("dialog");
  await expect(gift).toContainText("Bin nhận quà rồi!");
  await expect(gift).toContainText("Ăn kem cuối tuần");
  await gift.getByRole("button", { name: "Nhận quà" }).click();
  await expect(gift).toBeHidden();

  // --- Lịch sử đúng ở cả hai phía ---
  await kid.goto("/kid/history");
  const kidHistory = kid.locator("ol").first();
  await expect(kidHistory.locator("li")).toHaveCount(4);
  for (const text of ["Đổi thưởng: Ăn kem cuối tuần", "Đọc sách 15 phút (Truyện cổ tích)", "Dọn phòng chơi", "Đánh răng tối"]) {
    await expect(kidHistory).toContainText(text);
  }

  await parent.goto("/parent/history");
  const parentHistory = parent.locator("ol").first();
  await expect(parentHistory.locator("li")).toHaveCount(5);
  await expect(parentHistory.locator("li", { hasText: "Na · Dọn phòng chơi" })).toContainText("+3");
  await expect(parentHistory.locator("li", { hasText: "Bin · Dọn phòng chơi" })).toContainText("+3");
  await expect(parentHistory.locator("li", { hasText: "Bin · Đổi thưởng: Ăn kem cuối tuần" })).toContainText("−10");

  // Số dư cuối: Bin 5 + 3 + 4 - 10 = 2; Na 3.
  await kid.goto("/kid/shop");
  await expect(kid.getByText("2 Sao").first()).toBeVisible();
});
