import { Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/server/clock";
import { enableFamilyMode, loginChildWithPin } from "@/server/auth/family-mode";
import { changePassword, loginParent, registerParent, resetPasswordByEmail } from "@/server/auth/parent-auth";
import { resolveSession } from "@/server/auth/sessions";
import { createChild } from "@/server/domain/children";
import { createFamily, createInvite } from "@/server/domain/families";
import { createLogger, logSecurityEvent, setSecurityLogSink } from "@/server/log";
import { contentSecurityPolicy, securityHeaders } from "@/server/security-headers";
import { createTestDb, type TestDb } from "../helpers/db";

let t: TestDb;
const clock = fixedClock("2026-11-09T10:00:00Z");
let lines: string[] = [];

/** Logger thật (pino) ghi vào bộ nhớ, dùng làm sink cho log sự kiện bảo mật. */
function captureLogger() {
  lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(String(chunk));
      cb();
    },
  });
  const logger = createLogger(stream);
  setSecurityLogSink((event, fields) => logger.info({ kind: "security", event, ...fields }, event));
  return logger;
}

beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T10:00:00Z");
  captureLogger();
});
afterEach(async () => {
  setSecurityLogSink();
  await t.close();
});

describe("Log sự kiện bảo mật không chứa bí mật", () => {
  it("toàn bộ luồng xác thực: không có mật khẩu, PIN, token hay email thô trong log", async () => {
    const EMAIL = "bi-mat@example.com";
    const PASSWORD = "MatKhauRatBiMat1";
    const NEW_PASSWORD = "MatKhauMoiBiMat2";
    const PIN = "8642";
    const ctx = { ip: "203.0.113.9", clock };

    const reg = await registerParent(t.db, { email: EMAIL, password: PASSWORD, displayName: "Mẹ" }, ctx);
    const family = await createFamily(t.db, reg.parentId, { name: "Nhà A" });
    const invite = await createInvite(t.db, { parentId: reg.parentId, familyId: family.id }, clock);
    const kid = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: PIN });
    const device = await enableFamilyMode(t.db, { parentId: reg.parentId, familyId: family.id }, clock);
    for (let i = 0; i < 5; i++) await loginChildWithPin(t.db, { familyId: family.id, childId: kid.id, pin: "0000" }, clock).catch(() => {});
    for (let i = 0; i < 6; i++) await loginParent(t.db, { email: EMAIL, password: "Sai" + PASSWORD }, ctx).catch(() => {});
    clock.advance(16 * 60_000); // hết khóa đăng nhập 15 phút
    const s = await resolveSession(t.db, reg.token, "parent", clock);
    await changePassword(t.db, { parentId: reg.parentId, currentSessionIdHash: s!.idHash, currentPassword: PASSWORD, newPassword: NEW_PASSWORD }, ctx);
    await resetPasswordByEmail(t.db, EMAIL, PASSWORD);

    const all = lines.join("");
    const events = lines.map((l) => JSON.parse(l).event);
    expect(events).toEqual(expect.arrayContaining(["invite_created", "device_enabled", "pin_failed", "pin_locked", "login_failed", "login_locked", "password_changed", "password_reset"]));
    for (const secret of [EMAIL, PASSWORD, NEW_PASSWORD, PIN, reg.token, invite.token, device.token]) {
      expect(all).not.toContain(secret);
    }
    // Email chỉ xuất hiện dạng băm.
    expect(lines.map((l) => JSON.parse(l)).find((e) => e.event === "login_failed")).toMatchObject({ emailHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("redact của pino che trường nhạy cảm nếu lỡ truyền nhầm", () => {
    const logger = captureLogger();
    logger.info({ password: "p@ss", pin: "1234", token: "tok", email: "a@b.c", nested: { token: "tok2" } }, "oops");
    const out = lines.join("");
    for (const secret of ["p@ss", "1234", "tok", "a@b.c", "tok2"]) expect(out).not.toContain(`"${secret}"`);
    expect(out).toContain("[ẩn]");
    // logSecurityEvent chỉ nhận các trường được phép (kiểu dữ liệu), nhưng vẫn ghi đúng định dạng.
    logSecurityEvent("authz_denied", { ip: "1.2.3.4", detail: "x" });
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({ kind: "security", event: "authz_denied", ip: "1.2.3.4" });
  });
});

describe("Header bảo mật", () => {
  it("CSP production chặn khung nhúng, plugin, base và form ra ngoài; không có unsafe-eval", () => {
    const csp = contentSecurityPolicy(false);
    for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "upgrade-insecure-requests"]) {
      expect(csp).toContain(d);
    }
    expect(csp).not.toContain("unsafe-eval");
    const names = securityHeaders(false).map((h) => h.key);
    expect(names).toEqual(expect.arrayContaining(["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]));
  });

  it("dev: thêm unsafe-eval cho React, không đặt HSTS trên http://localhost", () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(securityHeaders(true).map((h) => h.key)).not.toContain("Strict-Transport-Security");
  });
});
