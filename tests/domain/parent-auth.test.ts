import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedClock, MINUTE, HOUR, DAY } from "@/server/clock";
import { parents, sessions } from "@/server/db/schema";
import { clientIpFrom } from "@/server/auth/client-ip";
import {
  changePassword,
  loginParent,
  logoutParent,
  registerParent,
  resetPasswordByEmail,
} from "@/server/auth/parent-auth";
import { resolveSession } from "@/server/auth/sessions";
import { sha256 } from "@/server/auth/crypto";
import { setSecurityLogSink } from "@/server/log";
import { createTestDb, type TestDb } from "../helpers/db";

let t: TestDb;
const clock = fixedClock("2026-11-09T10:00:00Z");
const ctx = { ip: "203.0.113.7", clock };
const events: string[] = [];

beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T10:00:00Z");
  events.length = 0;
  setSecurityLogSink((e) => events.push(e));
});
afterEach(async () => {
  await t.close();
});

const register = (email = "me@example.com", password = "matkhau123", ip = ctx.ip) =>
  registerParent(t.db, { email, password, displayName: "Mẹ" }, { ip, clock });

describe("Đăng ký tài khoản bố mẹ", () => {
  it("Đăng ký thành công: tạo tài khoản và đăng nhập luôn; mật khẩu được băm argon2id", async () => {
    const r = await register("  Me@Example.com ");
    const [p] = await t.db.select().from(parents);
    expect(p.email).toBe("me@example.com");
    expect(p.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await resolveSession(t.db, r.token, "parent", clock)).toMatchObject({ subjectId: r.parentId });
    // DB chỉ lưu SHA-256 của token.
    const [s] = await t.db.select().from(sessions);
    expect(s.idHash).toBe(sha256(r.token));
    expect(s.idHash).not.toBe(r.token);
  });

  it("Email đã tồn tại", async () => {
    await register();
    await expect(register("ME@example.com")).rejects.toMatchObject({ code: "CONFLICT", message: "Email đã được sử dụng" });
  });

  it("Mật khẩu quá ngắn", async () => {
    await expect(register("a@example.com", "1234567")).rejects.toMatchObject({ code: "INVALID_INPUT", message: expect.stringContaining("8 ký tự") });
  });

  it("Đăng ký quá nhiều: tài khoản thứ 6 từ cùng IP trong một giờ bị từ chối", async () => {
    for (let i = 1; i <= 5; i++) await register(`p${i}@example.com`);
    await expect(register("p6@example.com")).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(events).toContain("signup_limited");
    // IP khác vẫn đăng ký được; sau một giờ IP cũ cũng được.
    await register("other@example.com", "matkhau123", "198.51.100.1");
    clock.advance(HOUR);
    await register("p6@example.com");
  });
});

describe("Giới hạn đăng ký đếm cả lần trùng email", () => {
  it("Dò email bằng đăng ký bị chặn sau 5 lần mỗi giờ", async () => {
    await register();
    for (let i = 0; i < 4; i++) await expect(register()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(register()).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(register("moi@example.com")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("Đăng nhập bố mẹ", () => {
  it("Đăng nhập đúng và đăng xuất", async () => {
    await register();
    const r = await loginParent(t.db, { email: "ME@example.com", password: "matkhau123" }, ctx);
    expect(await resolveSession(t.db, r.token, "parent", clock)).not.toBeNull();
    await logoutParent(t.db, r.token);
    expect(await resolveSession(t.db, r.token, "parent", clock)).toBeNull();
  });

  it("Đăng nhập sai: cùng một thông báo chung cho sai email hay sai mật khẩu", async () => {
    await register();
    // Chờ từng lời gọi: tạo cả hai promise trước rồi mới await thì promise sau có thể reject khi chưa
    // có ai bắt (unhandled rejection), làm Vitest báo lỗi ngẫu nhiên tùy tốc độ argon2.
    const expected = { code: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng" };
    await expect(loginParent(t.db, { email: "me@example.com", password: "sai-mat-khau" }, ctx)).rejects.toMatchObject(expected);
    await expect(loginParent(t.db, { email: "khong-co@example.com", password: "matkhau123" }, ctx)).rejects.toMatchObject(expected);
  });

  it("Đăng nhập sai quá nhiều lần: khóa 15 phút kể cả khi mật khẩu đúng", async () => {
    await register();
    for (let i = 0; i < 5; i++) {
      await expect(loginParent(t.db, { email: "me@example.com", password: "sai" + i }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx)).rejects.toMatchObject({
      code: "LOCKED",
      message: "Đăng nhập sai nhiều lần, thử lại sau 15 phút",
    });
    clock.advance(14 * MINUTE);
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx)).rejects.toMatchObject({ code: "LOCKED" });
    clock.advance(2 * MINUTE);
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx)).resolves.toMatchObject({ token: expect.any(String) });
    expect(events).toContain("login_locked");
  });

  it("Khóa áp dụng như nhau với email chưa đăng ký", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(loginParent(t.db, { email: "ma@example.com", password: "x" + i }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(loginParent(t.db, { email: "ma@example.com", password: "x" }, ctx)).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("Đăng nhập đúng xóa chuỗi sai trước đó (đếm lần sai liên tiếp)", async () => {
    await register();
    for (let i = 0; i < 4; i++) await expect(loginParent(t.db, { email: "me@example.com", password: "sai" }, ctx)).rejects.toThrow();
    await loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx);
    for (let i = 0; i < 4; i++) await expect(loginParent(t.db, { email: "me@example.com", password: "sai" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("Lần sai liên tiếp vắt qua ranh giới 15 phút vẫn bị tính và khóa", async () => {
    await register();
    clock.set("2026-11-09T10:14:58Z");
    for (let i = 0; i < 4; i++) await expect(loginParent(t.db, { email: "me@example.com", password: "sai" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    clock.advance(4000);
    await expect(loginParent(t.db, { email: "me@example.com", password: "sai" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx)).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("Đổi mật khẩu sai nhiều lần cũng khóa theo email", async () => {
    const r = await register();
    const [s] = await t.db.select().from(sessions);
    const change = (currentPassword: string) =>
      changePassword(t.db, { parentId: r.parentId, currentSessionIdHash: s.idHash, currentPassword, newPassword: "matkhaumoi1" }, ctx);
    for (let i = 0; i < 5; i++) await expect(change("sai")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(change("matkhau123")).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("Mỗi IP thử tối đa 20 lần trong 15 phút", async () => {
    for (let i = 0; i < 20; i++) {
      await expect(loginParent(t.db, { email: `x${i}@example.com`, password: "sai" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await expect(loginParent(t.db, { email: "y@example.com", password: "sai" }, ctx)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    clock.advance(15 * MINUTE);
    await expect(loginParent(t.db, { email: "y@example.com", password: "sai" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});

describe("Đổi mật khẩu và hủy phiên", () => {
  it("Đổi mật khẩu: giữ phiên hiện tại, hủy phiên trên thiết bị khác", async () => {
    const { parentId } = await register();
    const phone = await loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx);
    const laptop = await loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx);
    const current = await resolveSession(t.db, laptop.token, "parent", clock);
    await changePassword(t.db, { parentId, currentSessionIdHash: current!.idHash, currentPassword: "matkhau123", newPassword: "matkhaumoi1" }, ctx);
    expect(await resolveSession(t.db, laptop.token, "parent", clock)).not.toBeNull();
    expect(await resolveSession(t.db, phone.token, "parent", clock)).toBeNull();
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhaumoi1" }, ctx)).resolves.toBeTruthy();
    expect(events).toContain("password_changed");
  });

  it("Sai mật khẩu hiện tại: từ chối và mật khẩu không đổi", async () => {
    const r = await register();
    const s = await resolveSession(t.db, r.token, "parent", clock);
    await expect(changePassword(t.db, { parentId: r.parentId, currentSessionIdHash: s!.idHash, currentPassword: "sai", newPassword: "matkhaumoi1" }, ctx)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(loginParent(t.db, { email: "me@example.com", password: "matkhau123" }, ctx)).resolves.toBeTruthy();
  });

  it("Mật khẩu mới phải đủ 8 ký tự", async () => {
    const r = await register();
    const s = await resolveSession(t.db, r.token, "parent", clock);
    await expect(changePassword(t.db, { parentId: r.parentId, currentSessionIdHash: s!.idHash, currentPassword: "matkhau123", newPassword: "ngan" }, ctx)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("Đặt lại bằng công cụ quản trị: hủy mọi phiên", async () => {
    const r = await register();
    await resetPasswordByEmail(t.db, "me@example.com", "matkhaumoi1");
    expect(await resolveSession(t.db, r.token, "parent", clock)).toBeNull();
    const [p] = await t.db.select().from(parents).where(eq(parents.id, r.parentId));
    expect(p.passwordHash).toMatch(/^\$argon2id\$/);
    expect(events).toContain("password_reset");
  });
});

describe("Phiên", () => {
  it("Phiên bố mẹ hết hạn sau 30 ngày không dùng, được gia hạn khi còn dùng", async () => {
    const r = await register();
    clock.advance(20 * DAY);
    expect(await resolveSession(t.db, r.token, "parent", clock)).not.toBeNull(); // gia hạn tới +30 ngày
    clock.advance(20 * DAY);
    expect(await resolveSession(t.db, r.token, "parent", clock)).not.toBeNull();
    clock.advance(31 * DAY);
    expect(await resolveSession(t.db, r.token, "parent", clock)).toBeNull();
  });

  it("Token sai loại phiên không dùng được", async () => {
    const r = await register();
    expect(await resolveSession(t.db, r.token, "child", clock)).toBeNull();
  });
});

describe("IP client", () => {
  it("lấy phần tử cuối của X-Forwarded-For", () => {
    expect(clientIpFrom("1.1.1.1, 203.0.113.7")).toBe("203.0.113.7");
    expect(clientIpFrom(null, "10.0.0.2")).toBe("10.0.0.2");
    expect(clientIpFrom(undefined)).toBe("unknown");
  });
});
