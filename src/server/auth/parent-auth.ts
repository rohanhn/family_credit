import { eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { parents } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { DomainError, invalid } from "../domain/errors";
import { logSecurityEvent } from "../log";
import { hashSecret, sha256, verifyDummy, verifySecret } from "./crypto";
import { clear, hit, hitStreak, LIMITS, lock, lockedUntil } from "./rate-limit";
import { authenticateDevice } from "./guards";
import { PARENT_ON_FAMILY_DEVICE_TTL_MS } from "./session-cookies";
import { createSession, deleteSession, deleteSessionsFor } from "./sessions";

// Đăng ký, đăng nhập, đổi mật khẩu của bố mẹ (spec family-accounts, design D4/D9).

export type AuthContext = {
  ip: string;
  clock?: Clock;
  /** Cookie `mc_device` của thiết bị đang đăng nhập (nếu có), để nhận biết máy của con. */
  deviceToken?: string;
};

/**
 * Tạo phiên bố mẹ. Thiết bị có phiên thiết bị còn hiệu lực (đang bật chế độ gia đình hoặc là máy
 * riêng của con) thì phiên bố mẹ chỉ sống 15 phút không thao tác; cookie `mc_device` giả hoặc đã hết
 * hạn không rút ngắn được phiên (design D2 của change polish-after-mvp).
 */
async function createParentSession(db: DbOrTx, parentId: number, ctx: AuthContext, clock: Clock) {
  const onFamilyDevice = (await authenticateDevice(db, ctx.deviceToken, clock)) !== null;
  return createSession(db, "parent", parentId, clock, onFamilyDevice ? { ttlMs: PARENT_ON_FAMILY_DEVICE_TTL_MS, persistTtl: true } : {});
}

export const MIN_PASSWORD_LENGTH = 8;
export const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không đúng";
export const LOCKED_MESSAGE = "Đăng nhập sai nhiều lần, thử lại sau 15 phút";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254) throw invalid("Email không hợp lệ");
  return e;
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw invalid(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
  if (password.length > 200) throw invalid("Mật khẩu quá dài");
}

function normalizeDisplayName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if ([...n].length < 1 || [...n].length > 30) throw invalid("Tên hiển thị phải dài từ 1 đến 30 ký tự");
  return n;
}

const emailKey = (emailHash: string) => `login:email:${emailHash}`;
const lockKey = (emailHash: string) => `login:lock:${emailHash}`;

export async function registerParent(
  db: Db,
  input: { email: string; password: string; displayName: string },
  ctx: AuthContext,
): Promise<{ parentId: number; token: string; expiresAt: Date }> {
  const clock = ctx.clock ?? systemClock;
  const email = normalizeEmail(input.email);
  validatePassword(input.password);
  const displayName = normalizeDisplayName(input.displayName);

  // Đếm mọi lần đăng ký (kể cả email đã dùng) trước khi chạy argon2: giới hạn cả việc dò email
  // qua thông báo "Email đã được sử dụng" lẫn chi phí CPU. Tăng rồi so nên đúng khi đồng thời.
  const signupKey = `signup:ip:${ctx.ip}`;
  if ((await hit(db, signupKey, LIMITS.signupIp.windowMs, clock)) > LIMITS.signupIp.max) {
    logSecurityEvent("signup_limited", { ip: ctx.ip });
    throw new DomainError("RATE_LIMITED", "Đăng ký quá nhiều tài khoản, thử lại sau");
  }

  const emailTaken = () => new DomainError("CONFLICT", "Email đã được sử dụng");
  const [existing] = await db.select({ id: parents.id }).from(parents).where(eq(parents.email, email));
  if (existing) throw emailTaken();
  const passwordHash = await hashSecret(input.password);
  try {
    return await db.transaction(async (tx) => {
      const [parent] = await tx.insert(parents).values({ email, displayName, passwordHash }).returning({ id: parents.id });
      const session = await createParentSession(tx, parent.id, ctx, clock);
      return { parentId: parent.id, ...session };
    });
  } catch (err) {
    // Hai request cùng email đồng thời: request sau vấp UNIQUE.
    if (isUniqueViolation(err)) throw emailTaken();
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

/**
 * Kiểm tra mật khẩu với khóa theo email (spec "Đăng nhập sai quá nhiều lần", design D9).
 * Tăng bộ đếm trước khi kiểm tra, nên nhiều request đồng thời cũng chỉ được thử tối đa `max` lần:
 * request thấy bộ đếm vượt `max` bị từ chối như đang khóa mà không chạy argon2.
 */
async function verifyWithLockout(
  db: Db,
  emailHash: string,
  verify: () => Promise<boolean>,
  clock: Clock,
  ip?: string,
): Promise<boolean> {
  const { max, horizonMs } = LIMITS.loginEmailFailures;
  if (await lockedUntil(db, lockKey(emailHash), LIMITS.loginEmailFailures.lockMs, clock)) {
    logSecurityEvent("login_locked", { ip, emailHash });
    throw new DomainError("LOCKED", LOCKED_MESSAGE);
  }
  const attempt = await hitStreak(db, emailKey(emailHash), horizonMs, clock);
  if (attempt > max) {
    logSecurityEvent("login_locked", { ip, emailHash });
    throw new DomainError("LOCKED", LOCKED_MESSAGE);
  }
  const ok = await verify();
  if (ok) {
    await clear(db, emailKey(emailHash));
    return true;
  }
  if (attempt >= max) {
    await lock(db, lockKey(emailHash), clock);
    await clear(db, emailKey(emailHash));
    logSecurityEvent("login_locked", { ip, emailHash });
  }
  return false;
}

export async function loginParent(
  db: Db,
  input: { email: string; password: string },
  ctx: AuthContext,
): Promise<{ parentId: number; token: string; expiresAt: Date }> {
  const clock = ctx.clock ?? systemClock;
  const email = input.email.trim().toLowerCase();
  const emailHash = sha256(email);

  if ((await hit(db, `login:ip:${ctx.ip}`, LIMITS.loginIp.windowMs, clock)) > LIMITS.loginIp.max) {
    logSecurityEvent("login_rate_limited", { ip: ctx.ip });
    throw new DomainError("RATE_LIMITED", "Thử đăng nhập quá nhiều lần, thử lại sau ít phút");
  }
  const [parent] = await db.select({ id: parents.id, passwordHash: parents.passwordHash }).from(parents).where(eq(parents.email, email));
  const ok = await verifyWithLockout(
    db,
    emailHash,
    () => (parent ? verifySecret(parent.passwordHash, input.password) : verifyDummy(input.password)),
    clock,
    ctx.ip,
  );
  if (!parent || !ok) {
    logSecurityEvent("login_failed", { ip: ctx.ip, emailHash });
    throw new DomainError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const session = await createParentSession(db, parent.id, ctx, clock);
  return { parentId: parent.id, ...session };
}

export function logoutParent(db: Db, token: string | undefined): Promise<void> {
  return deleteSession(db, token);
}

/** Đổi mật khẩu: cần mật khẩu hiện tại; hủy mọi phiên khác, giữ phiên hiện tại. */
export async function changePassword(
  db: Db,
  input: { parentId: number; currentSessionIdHash: string; currentPassword: string; newPassword: string },
  ctx: AuthContext,
): Promise<{ revokedSessions: number }> {
  const clock = ctx.clock ?? systemClock;
  validatePassword(input.newPassword);
  const [parent] = await db
    .select({ id: parents.id, email: parents.email, passwordHash: parents.passwordHash, familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.id, input.parentId));
  if (!parent) throw new DomainError("NOT_FOUND", "Không tìm thấy");

  const emailHash = sha256(parent.email);
  if (!(await verifyWithLockout(db, emailHash, () => verifySecret(parent.passwordHash, input.currentPassword), clock))) {
    throw new DomainError("INVALID_CREDENTIALS", "Mật khẩu hiện tại không đúng");
  }

  const passwordHash = await hashSecret(input.newPassword);
  const revoked = await db.transaction(async (tx) => {
    await tx.update(parents).set({ passwordHash }).where(eq(parents.id, parent.id));
    return deleteSessionsFor(tx, "parent", parent.id, input.currentSessionIdHash);
  });
  logSecurityEvent("password_changed", { parentId: parent.id, familyId: parent.familyId ?? undefined });
  return { revokedSessions: revoked };
}

/** Đặt lại mật khẩu bằng công cụ quản trị: hủy mọi phiên của bố mẹ đó. */
export async function resetPasswordByEmail(db: Db, email: string, newPassword: string): Promise<{ revokedSessions: number }> {
  const normalized = normalizeEmail(email);
  validatePassword(newPassword);
  const passwordHash = await hashSecret(newPassword);
  const result = await db.transaction(async (tx) => {
    const [parent] = await tx.update(parents).set({ passwordHash }).where(eq(parents.email, normalized)).returning({ id: parents.id, familyId: parents.familyId });
    if (!parent) throw new DomainError("NOT_FOUND", "Không có tài khoản với email này");
    const revoked = await deleteSessionsFor(tx, "parent", parent.id);
    return { parent, revoked };
  });
  logSecurityEvent("password_reset", { parentId: result.parent.id, familyId: result.parent.familyId ?? undefined });
  return { revokedSessions: result.revoked };
}
