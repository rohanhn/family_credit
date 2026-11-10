import { expect, test, type BrowserContext, type Request } from "@playwright/test";
import postgres from "postgres";
import { addChild, enableFamilyMode, kidLogin, registerFamily, setRandomClientIp } from "./helpers";

// Task 8.2 (design D11): phân quyền ở tầng Server Action. Lấy đúng request POST của action "Thưởng"
// từ phiên bố mẹ (action id nằm ở header `next-action`), rồi gửi lại y hệt bằng cookie của con:
// không được ghi thêm giao dịch nào.

async function transactionCount(familyName: string): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`
      select count(*)::int as n from transactions t join families f on f.id = t.family_id where f.name = ${familyName}`;
    return row.n;
  } finally {
    await sql.end();
  }
}

test("Phiên con gửi lại Server Action thưởng điểm của bố mẹ: bị từ chối, không ghi giao dịch", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const familyName = `Nhà action ${Date.now()}`;

  // Bố mẹ thưởng một lần, ghi lại request của Server Action.
  const parent = await (await browser.newContext()).newPage();
  await setRandomClientIp(parent);
  await registerFamily(parent, { familyName, prefix: "action" });
  await addChild(parent, "Bin", "1234", 1);
  await parent.goto("/parent/apply");
  await parent.getByText("Đột xuất (ngoài rule)").click();
  await parent.getByLabel("Số điểm").fill("5");
  await parent.getByLabel("Lý do (bắt buộc)").fill("Dọn bàn");
  const captured = parent.waitForRequest((r: Request) => r.method() === "POST" && !!r.headers()["next-action"]);
  await parent.getByRole("button", { name: /^Thưởng Bin/ }).click();
  const req = await captured;
  await expect(parent.getByText("Đã ghi: Dọn bàn +5")).toBeVisible();
  expect(await transactionCount(familyName)).toBe(1);

  const headers = { ...req.headers() };
  delete headers["cookie"];
  const replay = (ctx: BrowserContext) =>
    ctx.request.post(req.url(), { headers, data: req.postDataBuffer() ?? undefined, maxRedirects: 0 });
  // Đối chứng: gửi lại bằng phiên bố mẹ thì ghi được, nên cách gửi lại là hợp lệ.
  await replay(parent.context());
  expect(await transactionCount(familyName)).toBe(2);

  // Thiết bị của con: bố mẹ bật chế độ gia đình (phiên bố mẹ trên thiết bị kết thúc), con đăng nhập PIN.
  const kidContext = await browser.newContext();
  const device = await kidContext.newPage();
  await setRandomClientIp(device);
  await kidContext.addCookies((await parent.context().cookies()).filter((c) => c.name === "mc_parent"));
  await device.goto("/parent");
  await enableFamilyMode(device);
  await kidLogin(device, "Bin", "1234");
  const names = (await kidContext.cookies()).map((c) => c.name);
  expect(names).toContain("mc_child");
  expect(names).not.toContain("mc_parent");

  // Gửi lại đúng request đó bằng cookie của con: không ghi thêm.
  const res = await replay(kidContext);
  expect(res.status()).toBeLessThan(500);
  expect(await transactionCount(familyName)).toBe(2);
});
