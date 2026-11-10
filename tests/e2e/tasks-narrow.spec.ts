import { expect, test, type Page } from "@playwright/test";
import { addChild, registerFamily, setRandomClientIp } from "./helpers";

// Change polish-after-mvp task 3.1: danh sách nhiệm vụ dạng thẻ dưới 768px, dạng bảng từ 768px
// (spec ui-theme "Danh sách nhiệm vụ trên điện thoại", "Danh sách nhiệm vụ trên máy tính").

async function createTask(page: Page, name: string, points: string): Promise<void> {
  await page.goto("/parent/tasks");
  await page.getByLabel("Tên nhiệm vụ").fill(name);
  await page.getByLabel("Điểm", { exact: true }).fill(points);
  await page.getByRole("button", { name: "Tất cả các con" }).click();
  await page.getByRole("checkbox", { name: "Bin", exact: true }).check({ force: true });
  await page.getByRole("button", { name: /^Lưu \(bắt đầu từ/ }).click();
  await expect(page.getByText(`Đã tạo "${name}", bắt đầu từ ngày mai`)).toBeVisible();
}

test("Ở 360px nhiệm vụ hiện dạng thẻ, sửa và tạm dừng được, không cuộn ngang", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Chỉ chạy ở 360px");
  test.setTimeout(120_000);
  await setRandomClientIp(page);
  await registerFamily(page, { familyName: `Nhà thẻ nhiệm vụ ${Date.now()}`, prefix: "taskcard" });
  await addChild(page, "Bin", "1234", 1);
  await createTask(page, "Tưới cây ngoài ban công", "5");
  await page.reload();

  await expect(page.locator("table")).toBeHidden();
  const card = page.getByRole("list", { name: "Danh sách nhiệm vụ" }).getByRole("listitem").filter({ hasText: "Tưới cây ngoài ban công" });
  await expect(card).toBeVisible();
  for (const text of ["+5", "Hằng ngày", "Bin", "Riêng một con", /Từ \d{2}\/\d{2}/]) await expect(card).toContainText(text);

  // Hai nút nằm trọn trong màn hình, trang không cuộn ngang.
  for (const name of ["Sửa", "Tạm dừng"]) {
    const box = await card.getByRole("button", { name, exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x + box!.width, name).toBeLessThanOrEqual(360);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Sửa: form hiện ngay trong thẻ, lưu được.
  await card.getByRole("button", { name: "Sửa", exact: true }).click();
  await card.getByLabel("Điểm", { exact: true }).fill("7");
  await card.getByRole("button", { name: /^Lưu \(áp dụng từ/ }).click();
  // Lưu xong thì form sửa đóng lại.
  await expect(card.getByRole("button", { name: "Sửa", exact: true })).toBeVisible();
  await page.reload();
  await expect(card).toContainText("+7");

  // Tạm dừng đổi trạng thái.
  await card.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(card.getByText("Đã tạm dừng từ ngày mai")).toBeVisible();
  await page.reload();
  await expect(card.getByRole("button", { name: "Chạy lại", exact: true })).toBeVisible();
  await expect(card).toContainText("Tạm dừng");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("Ở 1280px nhiệm vụ vẫn hiện dạng bảng", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy ở 1280px");
  await setRandomClientIp(page);
  await registerFamily(page, { familyName: `Nhà bảng nhiệm vụ ${Date.now()}`, prefix: "tasktable" });
  await addChild(page, "Bin", "1234", 1);
  await createTask(page, "Gấp quần áo", "4");
  await page.reload();

  await expect(page.getByRole("list", { name: "Danh sách nhiệm vụ" })).toBeHidden();
  const row = page.getByRole("row").filter({ hasText: "Gấp quần áo" });
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: "Sửa", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Tạm dừng", exact: true })).toBeVisible();
  // Mỗi tên nút chỉ xuất hiện một lần trong cây accessibility (dạng thẻ đang ẩn).
  await expect(page.getByRole("button", { name: "Sửa", exact: true })).toHaveCount(1);
});
