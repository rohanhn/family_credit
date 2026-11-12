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

async function proposalStatuses(familyName: string): Promise<string[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Thiếu DATABASE_URL cho test e2e");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql`
      select p.status from adhoc_proposals p join children c on c.id = p.child_id join families f on f.id = c.family_id
      where f.name = ${familyName} order by p.id`;
    return rows.map((r) => r.status as string);
  } finally {
    await sql.end();
  }
}

// Spec family-accounts "Con cố tự duyệt đề xuất của mình". Request duyệt và từ chối của bố mẹ bị chặn ở trình duyệt
// (không tới server) để đề xuất còn chờ duyệt, rồi được gửi lại y hệt bằng cookie của con.
test("Phiên con gửi lại Server Action duyệt và từ chối đề xuất ngoài rule: bị từ chối, đề xuất vẫn chờ duyệt", async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Chỉ chạy một lần");
  test.setTimeout(120_000);
  const familyName = `Nhà tự duyệt ${Date.now()}`;

  const parent = await (await browser.newContext()).newPage();
  await setRandomClientIp(parent);
  const email = await registerFamily(parent, { familyName, prefix: "self-approve" });
  await addChild(parent, "Bin", "1234", 1);

  // Thiết bị của con: bố mẹ đăng nhập riêng trên thiết bị (để phiên bố mẹ ở máy kia còn dùng được),
  // bật chế độ gia đình, con đăng nhập PIN và gửi một đề xuất xin thưởng.
  const kidContext = await browser.newContext();
  const device = await kidContext.newPage();
  await setRandomClientIp(device);
  await device.goto("/login");
  await device.getByLabel("Email").fill(email);
  await device.getByLabel("Mật khẩu").fill("matkhau123");
  await device.getByRole("button", { name: "Đăng nhập" }).click();
  await device.waitForURL("**/parent");
  await enableFamilyMode(device);
  await kidLogin(device, "Bin", "1234");
  await device.goto("/kid/rules");
  await device.getByRole("button", { name: "Con xin thưởng" }).click();
  await device.getByLabel("Con đã làm việc gì?").fill("Tự thưởng cho mình");
  await device.getByLabel(/Con xin bao nhiêu/).fill("50");
  await device.getByRole("button", { name: "Gửi bố mẹ duyệt" }).click();
  await expect(device.getByText('Đã gửi "Tự thưởng cho mình" cho bố mẹ duyệt')).toBeVisible();
  expect(await proposalStatuses(familyName)).toEqual(["pending"]);

  // Bố mẹ bấm Duyệt rồi Từ chối: ghi lại hai request của Server Action nhưng không cho tới server.
  type Captured = { url: string; headers: Record<string, string>; body: Buffer | null };
  const captured: Captured[] = [];
  await parent.route("**/*", async (route) => {
    const r = route.request();
    if (r.method() === "POST" && r.headers()["next-action"]) {
      const headers = { ...(await r.allHeaders()) };
      delete headers["cookie"];
      captured.push({ url: r.url(), headers, body: r.postDataBuffer() });
      return route.abort();
    }
    return route.continue();
  });
  await parent.goto("/parent");
  await expect(parent.getByText("Bin · Tự thưởng cho mình")).toBeVisible();
  await parent.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect.poll(() => captured.length).toBe(1);
  await parent.goto("/parent");
  await parent.getByRole("button", { name: "Từ chối" }).click();
  await parent.getByLabel("Lý do (không bắt buộc)").fill("Thử");
  await parent.getByRole("button", { name: "Từ chối" }).click();
  await expect.poll(() => captured.length).toBe(2);
  await parent.unroute("**/*");
  expect(await proposalStatuses(familyName)).toEqual(["pending"]);

  const replay = (ctx: BrowserContext, c: Captured) => ctx.request.post(c.url, { headers: c.headers, data: c.body ?? undefined, maxRedirects: 0 });

  // Gửi lại cả hai bằng cookie của con: đề xuất vẫn chờ duyệt, không có giao dịch.
  for (const c of captured) {
    const res = await replay(kidContext, c);
    expect(res.status()).toBeLessThan(500);
  }
  expect(await proposalStatuses(familyName)).toEqual(["pending"]);
  expect(await transactionCount(familyName)).toBe(0);

  // Đối chứng: gửi lại request duyệt bằng phiên bố mẹ thì duyệt được, nên cách gửi lại là hợp lệ.
  await replay(parent.context(), captured[0]);
  expect(await proposalStatuses(familyName)).toEqual(["approved"]);
  expect(await transactionCount(familyName)).toBe(1);
});
