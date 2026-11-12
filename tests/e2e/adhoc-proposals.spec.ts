import { expect, test, type Browser, type Page } from "@playwright/test";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Spec reward-rules: con đề xuất thưởng/phạt ngoài rule, bố mẹ duyệt với số điểm sửa được hoặc từ chối.
// Bố mẹ và thiết bị của con là hai browser context riêng, như hai máy thật.

const PIN = "1234";

async function newPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await setRandomClientIp(page);
  return page;
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/parent");
}

/** Bố mẹ đăng ký gia đình có con "Bin"; trả về trang của bố mẹ và trang của Bin đã đăng nhập, đang ở màn Rule. */
async function setup(browser: Browser, prefix: string) {
  const parent = await newPage(browser);
  const email = await registerFamily(parent, { familyName: `Nhà đề xuất ${Date.now()}`, prefix });
  await addChild(parent, "Bin", PIN, 1);
  const kid = await newPage(browser);
  await login(kid, email);
  await enableFamilyMode(kid);
  await kidLogin(kid, "Bin", PIN);
  await kid.goto("/kid/rules");
  return { parent, kid };
}

/** Con mở form theo loại, điền và gửi. */
async function propose(kid: Page, kind: "reward" | "penalty", description: string, points: string): Promise<void> {
  await kid.getByRole("button", { name: kind === "reward" ? "Con xin thưởng" : "Con xin nhận phạt" }).click();
  await kid.getByLabel(kind === "reward" ? "Con đã làm việc gì?" : "Con đã mắc lỗi gì?").fill(description);
  await kid.getByLabel(kind === "reward" ? /Con xin bao nhiêu/ : /Nên trừ bao nhiêu/).fill(points);
  await kid.getByRole("button", { name: "Gửi bố mẹ duyệt" }).click();
}

test("Con gửi đề xuất mỗi loại, thấy trong mục đang chờ, hủy được; đủ 5 thì hết nút gửi", async ({ browser }) => {
  test.setTimeout(180_000);
  const { kid } = await setup(browser, "proposal-kid");
  const waiting = kid.getByRole("region", { name: "Đang chờ bố mẹ duyệt" });
  const section = kid.getByRole("region", { name: "Việc ngoài rule" });

  // Thiếu mô tả hoặc số điểm sai: báo lỗi, form vẫn mở và giữ nội dung đã gõ.
  await propose(kid, "reward", "", "10");
  await expect(section.getByRole("alert")).toHaveText("Con cần viết việc con đã làm");
  await kid.getByLabel("Con đã làm việc gì?").fill("Giúp bà xách đồ");
  await kid.getByLabel(/Con xin bao nhiêu/).fill("0");
  await kid.getByRole("button", { name: "Gửi bố mẹ duyệt" }).click();
  await expect(section.getByRole("alert")).toHaveText("Số điểm phải là số nguyên dương");
  await expect(kid.getByLabel("Con đã làm việc gì?")).toHaveValue("Giúp bà xách đồ");
  await kid.getByLabel(/Con xin bao nhiêu/).fill("10");
  await kid.getByRole("button", { name: "Gửi bố mẹ duyệt" }).click();
  await expect(section.getByText('Đã gửi "Giúp bà xách đồ" cho bố mẹ duyệt')).toBeVisible();

  await propose(kid, "penalty", "Con làm vỡ cốc", "5");
  await expect(section.getByText('Đã gửi "Con làm vỡ cốc" cho bố mẹ duyệt')).toBeVisible();

  // Cả hai nằm trong mục đang chờ, mới nhất trước; tự nhận phạt hiển thị số âm.
  const cards = waiting.locator("div", { has: kid.getByRole("button", { name: "Hủy" }) });
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Con làm vỡ cốc");
  await expect(cards.nth(0)).toContainText("−5 Sao · con tự nhận phạt");
  await expect(cards.nth(1)).toContainText("Giúp bà xách đồ");
  await expect(cards.nth(1)).toContainText("+10 Sao · con xin thưởng");

  // Hủy một đề xuất.
  await cards.nth(0).getByRole("button", { name: "Hủy" }).click();
  await expect(cards).toHaveCount(1);
  await expect(waiting).not.toContainText("Con làm vỡ cốc");

  // Đủ 5 đề xuất chờ: hai nút được thay bằng dòng nhắc; hủy bớt thì gửi tiếp được.
  for (let i = 2; i <= 5; i++) {
    await propose(kid, "reward", `Việc tốt ${i}`, "1");
    await expect(cards).toHaveCount(i);
  }
  await expect(section).toContainText("Con đang có 5 đề xuất chờ bố mẹ duyệt");
  await expect(kid.getByRole("button", { name: "Con xin thưởng" })).toHaveCount(0);
  await expect(kid.getByRole("button", { name: "Con xin nhận phạt" })).toHaveCount(0);
  await cards.nth(0).getByRole("button", { name: "Hủy" }).click();
  await expect(cards).toHaveCount(4);
  await expect(kid.getByRole("button", { name: "Con xin thưởng" })).toBeVisible();
});
