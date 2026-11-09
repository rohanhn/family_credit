import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { addChild, enablePersonalDevice, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

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

/** Thời hạn còn lại (giờ) của phiên con mới nhất trong DB cho con `name` của gia đình `familyName`. */
async function childSessionHoursLeft(familyName: string, name: string): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`
      select extract(epoch from (s.expires_at - now())) / 3600 as hours
      from sessions s join children c on c.id = s.subject_id join families f on f.id = c.family_id
      where s.subject_type = 'child' and c.name = ${name} and f.name = ${familyName}
      order by s.created_at desc limit 1`;
    return Number(row.hours);
  } finally {
    await sql.end();
  }
}

test("Máy riêng: con nhập PIN mỗi lần mở lại trình duyệt; phiên không hết hạn sau 2 giờ", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const familyName = `Nhà mở lại ${Date.now()}`;
  const phone = await newPage(browser);
  await registerFamily(phone, { familyName, prefix: "reopen" });
  await addChild(phone, "Bin", "1234", 1);
  await phone.goto("/parent");
  await enablePersonalDevice(phone, "Bin");
  await kidLogin(phone, "Bin", "1234");

  // Cookie phiên con là cookie phiên trình duyệt (không có hạn); cookie thiết bị thì có hạn.
  const cookies = await phone.context().cookies();
  expect(cookies.find((c) => c.name === "mc_child")?.expires).toBe(-1);
  expect(cookies.find((c) => c.name === "mc_device")!.expires).toBeGreaterThan(0);
  // Phiên trong DB sống 30 ngày, không phải 2 giờ.
  expect(await childSessionHoursLeft(familyName, "Bin")).toBeGreaterThan(29 * 24);
  await phone.goto("/kid/history");
  await expect(phone).toHaveURL(/\/kid\/history$/);

  // "Đóng hẳn trình duyệt": chỉ giữ lại các cookie có hạn, như trình duyệt sau khi mở lại.
  const reopened = await browser.newContext();
  await reopened.addCookies(cookies.filter((c) => c.expires > 0));
  const again = await reopened.newPage();
  await again.goto("/kid/home");
  await again.waitForURL("**/kid");
  await expect(again.getByRole("button", { name: /^Bin/ })).toBeVisible();
  await kidLogin(again, "Bin", "1234");
});

async function typePin(page: Page, pin: string): Promise<void> {
  for (const d of pin) await page.getByRole("button", { name: `Số ${d}`, exact: true }).click();
}

test("Con đổi PIN: PIN cũ không đăng nhập được, PIN mới thì được; bố mẹ thấy PIN đổi lần cuối", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const parent = await newPage(browser);
  const email = await registerFamily(parent, { familyName: `Nhà đổi PIN ${Date.now()}`, prefix: "pin" });
  await addChild(parent, "Bin", "1234", 1);
  await parent.goto("/parent/settings");
  await expect(parent.getByText("PIN chưa đổi từ khi tạo")).toBeVisible();

  const phone = await newPage(browser);
  await login(phone, email);
  await phone.goto("/parent");
  await enablePersonalDevice(phone, "Bin");
  await kidLogin(phone, "Bin", "1234");

  await phone.goto("/kid/pin");
  await expect(phone.getByText("Bước 1/3")).toBeVisible();
  await typePin(phone, "0000");
  await typePin(phone, "4321");
  await typePin(phone, "4321");
  await expect(phone.getByRole("alert").filter({ hasText: "PIN hiện tại chưa đúng, con thử lại nhé" })).toBeVisible();
  await typePin(phone, "1234");
  await typePin(phone, "4321");
  await typePin(phone, "4321");
  await expect(phone.getByRole("status")).toContainText("Đã đổi PIN");

  // Thoát rồi đăng nhập lại: PIN cũ sai, PIN mới đúng.
  await phone.locator("form", { has: phone.getByRole("button", { name: "Thoát" }) }).filter({ visible: true }).first().getByRole("button").click();
  await phone.waitForURL("**/kid");
  await typePin(phone, "1234");
  await expect(phone.getByRole("alert").filter({ hasText: "PIN chưa đúng" })).toBeVisible();
  await kidLogin(phone, "Bin", "4321");

  await parent.goto("/parent/settings");
  await expect(parent.getByText(/PIN đổi lần cuối: /)).toBeVisible();
});
