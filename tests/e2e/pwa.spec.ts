import { expect, test } from "@playwright/test";

// Spec ui-theme "Cài ứng dụng lên màn hình chính": manifest hợp lệ, icon tải được, trang có link manifest.

test("Manifest có display standalone, start_url '/', và các icon trả 200", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ name: "Sao nhà mình", start_url: "/", display: "standalone" });
  expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`)).toEqual(["192x192/any", "512x512/any", "512x512/maskable"]);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status(), icon.src).toBe(200);

  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveCount(1);
  expect((await request.get((await apple.getAttribute("href"))!)).status()).toBe(200);
});
