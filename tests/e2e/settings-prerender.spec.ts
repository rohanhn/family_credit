import { expect, test } from "@playwright/test";
import { addChild, enableFamilyMode, registerFamily, setRandomClientIp } from "./helpers";
import { E2E_SERVER_LOG, markServerLog } from "./server-log";

// Change polish-after-mvp task 4.1: mở trang cài đặt (có thiết bị và con) không làm Next cảnh báo
// "unstable value `Date.now()` while prerendering" trong log server (design D5).

test("Trang cài đặt không gây cảnh báo prerender Date.now()", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const readLog = markServerLog();
  test.skip(!readLog, `Không có log server ở ${E2E_SERVER_LOG} (server chạy ngoài Playwright?)`);

  await setRandomClientIp(page);
  const email = await registerFamily(page, { familyName: `Nhà cài đặt ${Date.now()}`, prefix: "settings" });
  await addChild(page, "Bin", "1234", 1);

  // Bật chế độ gia đình (trang cài đặt có danh sách thiết bị), rồi bố mẹ đăng nhập lại trên máy này.
  await enableFamilyMode(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/parent");

  // Mở bằng điều hướng phía client (có prefetch) và tải thẳng.
  await page.goto("/parent");
  await page.locator('header a[href="/parent/settings"]').first().click();
  await expect(page.getByRole("heading", { name: "Thiết bị của con" })).toBeVisible();
  await expect(page.getByText(/Bật ngày/)).toBeVisible();
  await page.goto("/parent/settings");
  await expect(page.getByText(/Bật ngày/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  // Log được ghi bất đồng bộ.
  await page.waitForTimeout(1000);

  expect(readLog!()).not.toContain("unstable value");
});
