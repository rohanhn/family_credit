import { expect, test } from "@playwright/test";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Spec family-accounts "Phân quyền bố mẹ và con": thiết bị chế độ gia đình không còn phiên bố mẹ,
// nên con dùng thiết bị đó không vào được khu vực bố mẹ.

test("Bật chế độ gia đình kết thúc phiên bố mẹ trên thiết bị; con không vào được /parent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  await setRandomClientIp(page);
  await registerFamily(page, { familyName: `Nhà phân quyền ${Date.now()}`, prefix: "authz" });
  await addChild(page, "Bin", "1234", 1);
  await page.goto("/parent");
  await enableFamilyMode(page);

  await page.goto("/parent");
  await page.waitForURL("**/login");

  await kidLogin(page, "Bin", "1234");
  await page.goto("/parent/settings");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});
