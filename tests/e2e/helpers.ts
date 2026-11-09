import type { Page } from "@playwright/test";

/**
 * Gán một IP client ngẫu nhiên (qua X-Forwarded-For, như Traefik) cho trang, để các lượt test
 * không đụng giới hạn đăng ký/đăng nhập theo IP của nhau (design D9).
 */
export async function setRandomClientIp(page: Page): Promise<string> {
  const ip = `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  return ip;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Bố mẹ đăng ký và tạo gia đình qua giao diện; trang dừng ở /parent. */
export async function registerFamily(page: Page, opts: { familyName: string; displayName?: string; prefix?: string }): Promise<string> {
  const email = uniqueEmail(opts.prefix ?? "e2e");
  await page.goto("/register");
  await page.getByLabel("Tên hiển thị").fill(opts.displayName ?? "Mẹ");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel("Tên gia đình").fill(opts.familyName);
  await page.getByRole("button", { name: "Tạo gia đình" }).click();
  await page.waitForURL("**/parent");
  return email;
}

/** Thêm hồ sơ con trong Cài đặt. `avatar` là số thứ tự trong bộ avatar (1–6). */
export async function addChild(page: Page, name: string, pin: string, avatar = 1): Promise<void> {
  await page.goto("/parent/settings");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Thêm con" }) });
  await form.getByLabel("Tên hiển thị").fill(name);
  await form.getByRole("radio", { name: `Avatar ${avatar}`, exact: true }).check({ force: true });
  await form.getByLabel("PIN 4 chữ số").fill(pin);
  await form.getByRole("button", { name: "Thêm con" }).click();
  await page.getByText(`Đã thêm ${name}`).waitFor();
}

/** Bật chế độ gia đình (máy dùng chung) trên thiết bị hiện tại; trang dừng ở màn chọn avatar. */
export async function enableFamilyMode(page: Page): Promise<void> {
  await page.locator("summary", { hasText: "Bật chế độ gia đình" }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: /^Máy dùng chung/ }).filter({ visible: true }).first().click();
  await page.waitForURL("**/kid");
}

/** Bật thiết bị hiện tại thành máy riêng của một con; trang dừng ở màn nhập PIN. */
export async function enablePersonalDevice(page: Page, childName: string): Promise<void> {
  await page.locator("summary", { hasText: "Bật chế độ gia đình" }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: `Máy riêng của ${childName}` }).filter({ visible: true }).first().click();
  await page.waitForURL("**/kid");
}

/** Con chọn avatar và nhập PIN trên màn chọn avatar. */
export async function kidLogin(page: Page, name: string, pin: string): Promise<void> {
  if (!page.url().endsWith("/kid")) await page.goto("/kid");
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  for (const d of pin) await page.getByRole("button", { name: `Số ${d}`, exact: true }).click();
  await page.waitForURL("**/kid/home");
}
