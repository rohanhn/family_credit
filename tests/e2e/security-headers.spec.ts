import { expect, test, type Page } from "@playwright/test";
import { uniqueEmail, setRandomClientIp } from "./helpers";

// Task 3.7: header bảo mật có mặt, và các trang chính chạy không có lỗi CSP trong console.

function collectCspErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test("trang đăng nhập có header bảo mật và không lỗi CSP", async ({ page }) => {
  const cspErrors = collectCspErrors(page);
  const res = await page.goto("/login");
  const h = res!.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("object-src 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  expect(cspErrors).toEqual([]);
});

test("luồng tới màn con chạy không lỗi CSP", async ({ page }) => {
  const cspErrors = collectCspErrors(page);
  await setRandomClientIp(page);
  const email = uniqueEmail("csp");

  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill("Mẹ");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Tên gia đình").fill("Nhà CSP");
  await page.getByRole("button", { name: "Tạo gia đình" }).click();
  await page.waitForURL("**/parent");

  await page.goto("/parent/settings");
  await page.getByLabel("Tên hiển thị").fill("Bin");
  await page.getByLabel("PIN 4 chữ số").fill("1234");
  await page.getByRole("button", { name: "Thêm con" }).click();
  await expect(page.getByText("Đã thêm Bin")).toBeVisible();

  await page.getByRole("button", { name: "Bật chế độ gia đình" }).click();
  await page.waitForURL("**/kid");
  await expect(page.getByLabel("Mã PIN 4 số")).toBeFocused();
  await page.keyboard.type("1234");
  await page.waitForURL("**/kid/home");
  await expect(page.getByText("Con đang có")).toBeVisible();

  expect(cspErrors).toEqual([]);
});
