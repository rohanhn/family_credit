import { expect, test, type Page } from "@playwright/test";
import { addChild, enableFamilyMode, kidLogin, registerFamily, useRandomClientIp } from "./helpers";

// Task 7.4 (spec ui-theme "Giao diện responsive"): không có thanh cuộn ngang ở 360px trên các trang chính,
// khu vực con chuyển giữa thanh tab dưới và sidebar đúng ở 768px, vùng bấm phía con tối thiểu 44x44px.

const PARENT_PAGES = ["/parent", "/parent/apply", "/parent/tasks", "/parent/rules", "/parent/shop", "/parent/history", "/parent/settings"];
const KID_PAGES = ["/kid/home", "/kid/shop", "/kid/history", "/kid/rules", "/kid/theme"];

async function expectNoHorizontalScroll(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `${path} cuộn ngang`).toBeLessThanOrEqual(innerWidth);
}

/** Phần tử bấm được đang hiển thị nhỏ hơn 44x44px. */
async function smallTapTargets(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("a, button, select, input:not([type=hidden]):not(.sr-only), label:has(> input.sr-only)")]
      .filter((el) => {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden" || el.closest("nextjs-portal")) return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && (b.width < 44 || b.height < 44);
      })
      .map((el) => `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"`),
  );
}

test("Các trang chính không cuộn ngang ở 360px; khu vực con đổi bố cục ở 768px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Tự đặt kích thước màn hình, chỉ chạy một lần");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await useRandomClientIp(page);

  await expectNoHorizontalScroll(page, "/login");
  await expectNoHorizontalScroll(page, "/register");

  await registerFamily(page, { familyName: "Nhà Bin & Na", prefix: "resp" });
  await addChild(page, "Bin", "1234", 1);
  await addChild(page, "Na", "5678", 2);
  for (const path of PARENT_PAGES) await expectNoHorizontalScroll(page, path);

  await page.goto("/parent");
  await enableFamilyMode(page);
  await expectNoHorizontalScroll(page, "/kid");
  expect(await smallTapTargets(page), "vùng bấm ở màn chọn avatar").toEqual([]);

  await kidLogin(page, "Bin", "1234");
  for (const path of KID_PAGES) {
    await expectNoHorizontalScroll(page, path);
    expect(await smallTapTargets(page), `vùng bấm ở ${path}`).toEqual([]);
  }

  // Dưới 768px: thanh tab dưới, không có sidebar. Từ 768px: sidebar, không có thanh tab.
  const tabBar = page.locator("nav.fixed");
  const sidebar = page.locator("aside").first();
  await page.goto("/kid/home");
  await page.setViewportSize({ width: 767, height: 800 });
  await expect(tabBar).toBeVisible();
  await expect(sidebar).toBeHidden();
  await page.setViewportSize({ width: 768, height: 800 });
  await expect(tabBar).toBeHidden();
  await expect(sidebar).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(sidebar).toBeVisible();
  expect(await smallTapTargets(page), "vùng bấm ở /kid/home (1280px)").toEqual([]);
});
