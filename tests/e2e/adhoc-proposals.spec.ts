import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
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

/** Thẻ trong hàng chờ duyệt của bố mẹ (form Duyệt là con trực tiếp của thẻ) có chứa đoạn chữ `text`. */
function queueCard(page: Page, text: string): Locator {
  return page.locator("div:has(> form)", { has: page.getByRole("button", { name: "Duyệt", exact: true }) }).filter({ hasText: text });
}

test("Bố mẹ sửa điểm rồi duyệt đề xuất xin thưởng, từ chối đề xuất tự nhận phạt kèm lý do", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Luồng dài, chỉ chạy một lần");
  test.setTimeout(180_000);
  const { parent, kid } = await setup(browser, "proposal-flow");

  // --- Con xin thưởng 20, bố mẹ sửa thành 8 rồi duyệt ---
  await propose(kid, "reward", "Giúp bà xách đồ", "20");
  await expect(kid.getByText('Đã gửi "Giúp bà xách đồ" cho bố mẹ duyệt')).toBeVisible();

  await parent.goto("/parent");
  const rewardCard = queueCard(parent, "Bin · Giúp bà xách đồ");
  await expect(rewardCard).toHaveCount(1);
  await expect(rewardCard).toContainText("Xin thưởng");
  await expect(rewardCard).toContainText("+20");
  const points = rewardCard.getByLabel("Số điểm");
  await expect(points).toHaveValue("20");
  // Số điểm sửa không hợp lệ: báo lỗi, đề xuất vẫn nằm trong hàng chờ.
  await points.fill("0");
  await rewardCard.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(rewardCard.getByRole("alert")).toHaveText("Số điểm phải là số nguyên dương");
  await expect(points).toHaveValue("0");
  await points.fill("8");
  await rewardCard.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(rewardCard).toHaveCount(0);
  await expect(parent.getByRole("listitem").filter({ hasText: "Bin · Giúp bà xách đồ" }).first()).toContainText("+8");

  // Con thấy màn ăn mừng với số điểm đã sửa.
  await kid.goto("/kid/home");
  const celebrate = kid.getByRole("dialog");
  await expect(celebrate).toContainText("Giỏi quá, Bin ơi!");
  await expect(celebrate).toContainText("Giúp bà xách đồ");
  await expect(celebrate).toContainText("+8");
  await expect(celebrate).not.toContainText("20");
  await celebrate.getByRole("button", { name: "Nhận quà" }).click();
  await expect(celebrate).toBeHidden();

  // --- Con tự nhận phạt 10 khi chỉ có 8: bố mẹ thấy cảnh báo, từ chối kèm lý do ---
  await kid.goto("/kid/rules");
  await propose(kid, "penalty", "Con làm vỡ cốc", "10");
  await expect(kid.getByText('Đã gửi "Con làm vỡ cốc" cho bố mẹ duyệt')).toBeVisible();

  await parent.goto("/parent");
  const penaltyCard = queueCard(parent, "Bin · Con làm vỡ cốc");
  await expect(penaltyCard).toHaveCount(1);
  await expect(penaltyCard).toContainText("Tự nhận phạt");
  await expect(penaltyCard).toContainText("−10");
  await expect(penaltyCard).toContainText("Số dư hiện tại (8) chỉ đủ trừ 8; lịch sử vẫn ghi mức gốc.");
  await penaltyCard.getByRole("button", { name: "Từ chối" }).click();
  await parent.getByLabel("Lý do (không bắt buộc)").fill("Con đã biết nhận lỗi là tốt rồi");
  await parent.getByRole("button", { name: "Từ chối" }).click();
  await expect(parent.getByText("Bin · Con làm vỡ cốc")).toHaveCount(0);

  // Con thấy thông báo bị từ chối kèm lý do; số dư vẫn là 8 và mục đang chờ đã hết.
  await kid.goto("/kid/home");
  const rejected = kid.getByRole("dialog");
  await expect(rejected).toContainText("Bố mẹ chưa duyệt");
  await expect(rejected).toContainText("Con làm vỡ cốc");
  await expect(rejected).toContainText("Bố mẹ nhắn: Con đã biết nhận lỗi là tốt rồi");
  await rejected.getByRole("button", { name: "Con biết rồi" }).click();
  await expect(rejected).toBeHidden();

  await kid.goto("/kid/history");
  const history = kid.locator("ol").first();
  await expect(history.locator("li")).toHaveCount(1);
  await expect(history).toContainText("Giúp bà xách đồ");
  await expect(history).toContainText("+8");
  await kid.goto("/kid/rules");
  await expect(kid.getByRole("region", { name: "Đang chờ bố mẹ duyệt" })).toHaveCount(0);
});
