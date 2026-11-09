import { eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { parents } from "../db/schema";
import type { Db } from "../db/types";
import { DomainError, invalid } from "../domain/errors";
import { logSecurityEvent } from "../log";
import { hashSecret, sha256, verifyDummy, verifySecret } from "./crypto";
import { clear, hit, LIMITS, lock, lockedUntil, peek } from "./rate-limit";
import { createSession, deleteSession, deleteSessionsFor } from "./sessions";

// Đăng ký, đăng nhập, đổi mật khẩu của bố mẹ (spec family-accounts, design D4/D9).

export type AuthContext = { ip: string; clock?: Clock };

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

  const signupKey = `signup:ip:${ctx.ip}`;
  if ((await peek(db, signupKey, LIMITS.signupIp.windowMs, clock)) >= LIMITS.signupIp.max) {
    logSecurityEvent("signup_limited", { ip: ctx.ip });
    throw new DomainError("RATE_LIMITED", "Đăng ký quá nhiều tài khoản, thử lại sau");
  }

  const passwordHash = await hashSecret(input.password);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: parents.id }).from(parents).where(eq(parents.email, email));
    if (existing) throw new DomainError("CONFLICT", "Email đã được sử dụng");
    const [parent] = await tx.insert(parents).values({ email, displayName, passwordHash }).returning({ id: parents.id });
    await hit(tx, signupKey, LIMITS.signupIp.windowMs, clock);
    const session = await createSession(tx, "parent", parent.id, clock);
    return { parentId: parent.id, ...session };
  });
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
  if (await lockedUntil(db, lockKey(emailHash), LIMITS.loginEmailFailures.lockMs, clock)) {
    logSecurityEvent("login_locked", { ip: ctx.ip, emailHash });
    throw new DomainError("LOCKED", LOCKED_MESSAGE);
  }

  const [parent] = await db.select({ id: parents.id, passwordHash: parents.passwordHash }).from(parents).where(eq(parents.email, email));
  const ok = parent ? await verifySecret(parent.passwordHash, input.password) : await verifyDummy(input.password);

  if (!parent || !ok) {
    const failures = await hit(db, emailKey(emailHash), LIMITS.loginEmailFailures.windowMs, clock);
    logSecurityEvent("login_failed", { ip: ctx.ip, emailHash });
    if (failures >= LIMITS.loginEmailFailures.max) {
      await lock(db, lockKey(emailHash), clock);
      await clear(db, emailKey(emailHash));
      logSecurityEvent("login_locked", { ip: ctx.ip, emailHash });
    }
    throw new DomainError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  await clear(db, emailKey(emailHash));
  const session = await createSession(db, "parent", parent.id, clock);
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
  if (await lockedUntil(db, lockKey(emailHash), LIMITS.loginEmailFailures.lockMs, clock)) {
    throw new DomainError("LOCKED", LOCKED_MESSAGE);
  }
  if (!(await verifySecret(parent.passwordHash, input.currentPassword))) {
    const failures = await hit(db, emailKey(emailHash), LIMITS.loginEmailFailures.windowMs, clock);
    if (failures >= LIMITS.loginEmailFailures.max) {
      await lock(db, lockKey(emailHash), clock);
      await clear(db, emailKey(emailHash));
    }
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
