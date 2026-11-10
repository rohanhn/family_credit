import { expect, test, type Page } from "@playwright/test";
import { addChild, registerFamily, setRandomClientIp } from "./helpers";

// Change fix-review-low-findings task 4.1 (design D5): nút loa theo thiết bị ở phía bố mẹ.
// Đếm số oscillator Web Audio được tạo để biết có phát âm hay không.

async function countOscillators(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __osc: number }).__osc);
}

async function giveAdhoc(page: Page, reason: string) {
  await page.goto("/parent/apply");
  await page.getByText("Đột xuất (ngoài rule)").click();
  await page.getByLabel("Số điểm").fill("3");
  await page.getByLabel("Lý do (bắt buộc)").fill(reason);
  await page.getByRole("button", { name: /^Thưởng Bin/ }).click();
  await expect(page.getByText(`Đã ghi: ${reason} +3`)).toBeVisible();
}

test("Bố mẹ tắt loa trên thiết bị: đăng nhập lại vẫn tắt, thưởng không phát âm, vẫn có chữ Đã ghi", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const w = window as unknown as { __osc: number };
    w.__osc = 0;
    const orig = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      w.__osc++;
      return orig.call(this);
    };
  });
  await setRandomClientIp(page);
  const email = await registerFamily(page, { familyName: `Nhà loa ${Date.now()}`, prefix: "sound" });
  await addChild(page, "Bin", "1234", 1);

  // Loa đang bật: thưởng thì phát âm.
  await giveAdhoc(page, "Dọn bàn");
  await expect.poll(() => countOscillators(page)).toBeGreaterThan(0);

  // Tắt loa ở header, đăng xuất rồi đăng nhập lại trên cùng thiết bị.
  await page.getByRole("button", { name: "Tắt âm thanh" }).first().click();
  await expect(page.getByRole("button", { name: "Bật âm thanh" }).first()).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill("matkhau123");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/parent");
  await expect(page.getByRole("button", { name: "Bật âm thanh" }).first()).toBeVisible();

  await giveAdhoc(page, "Tưới cây");
  await page.waitForTimeout(500);
  expect(await countOscillators(page)).toBe(0);
});
