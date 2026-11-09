import { expect, test, type Browser, type Page } from "@playwright/test";
import { addChild, enablePersonalDevice, registerFamily, setRandomClientIp } from "./helpers";

// Change add-kid-personal-device: máy riêng của con (spec family-accounts "Máy riêng của con").

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

test("Máy riêng chỉ hiện con sở hữu máy; bố mẹ thấy và thu hồi được trong cài đặt", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const parent = await newPage(browser);
  const email = await registerFamily(parent, { familyName: `Nhà máy riêng ${Date.now()}`, prefix: "personal" });
  await addChild(parent, "Bin", "1234", 1);
  await addChild(parent, "Na", "5678", 4);

  // Điện thoại của Bin: bố mẹ đăng nhập trực tiếp rồi bật máy riêng.
  const phone = await newPage(browser);
  await login(phone, email);
  await phone.goto("/parent");
  await enablePersonalDevice(phone, "Bin");
  await expect(phone.getByRole("button", { name: /^Bin/ })).toBeVisible();
  await expect(phone.getByRole("button", { name: /^Na/ })).toHaveCount(0);
  // Phiên bố mẹ trên điện thoại đã kết thúc.
  await phone.goto("/parent");
  await phone.waitForURL("**/login");

  // Cài đặt của bố mẹ ghi rõ máy riêng; thu hồi thì điện thoại về màn chưa bật.
  await parent.goto("/parent/settings");
  const devices = parent.getByRole("region", { name: "Thiết bị của con" });
  const row = devices.locator("form", { hasText: "Máy riêng của Bin" });
  await expect(row).toContainText("tự gia hạn khi con còn dùng");
  await row.getByRole("button", { name: "Thu hồi" }).click();
  await expect(devices.getByText("Máy riêng của Bin")).toHaveCount(0);
  await phone.goto("/kid");
  await expect(phone.getByRole("heading", { name: "Thiết bị chưa bật chế độ gia đình" })).toBeVisible();
});
