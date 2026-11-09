import { and, asc, eq, isNull } from "drizzle-orm";
import { systemClock, type Clock, MINUTE } from "../clock";
import { children, sessions } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { DomainError, invalid, notFound } from "../domain/errors";
import { logSecurityEvent } from "../log";
import { hashSecret, verifySecret } from "./crypto";
import { validatePin } from "../domain/children";
import { PERSONAL_CHILD_TTL_MS } from "./session-cookies";
import { createSession, deleteSession } from "./sessions";

// Chế độ gia đình và đăng nhập con bằng avatar + PIN (spec family-accounts, design D4).

export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MS = 5 * MINUTE;
export const PIN_WRONG_MESSAGE = "PIN chưa đúng, con thử lại nhé";

export function pinLockedMessage(minutesLeft: number): string {
  return `Con nhập sai nhiều lần rồi. Đợi ${minutesLeft} phút nữa rồi thử lại nhé`;
}

/**
 * Bố mẹ đã đăng nhập bật chế độ gia đình trên thiết bị hiện tại: cấp phiên `device` 90 ngày và kết thúc
 * phiên bố mẹ trên thiết bị đó (design D4: cookie device chỉ mở màn chọn avatar), để con dùng thiết bị
 * không vào được khu vực bố mẹ.
 */
export async function enableFamilyMode(
  db: DbOrTx,
  auth: { parentId: number; familyId: number },
  clock: Clock = systemClock,
  parentToken?: string,
) {
  await deleteSession(db, parentToken);
  const session = await createSession(db, "device", auth.familyId, clock);
  logSecurityEvent("device_enabled", { familyId: auth.familyId, parentId: auth.parentId, detail: "shared" });
  return session;
}

/**
 * Bố mẹ bật thiết bị hiện tại thành máy riêng của một con (spec "Máy riêng của con", design D3):
 * con phải thuộc gia đình và chưa lưu trữ; kết thúc phiên bố mẹ và phiên thiết bị cũ của chính máy
 * này, rồi cấp phiên `device` gắn với con đó.
 */
export async function enablePersonalDevice(
  db: DbOrTx,
  auth: { parentId: number; familyId: number },
  childId: number,
  clock: Clock = systemClock,
  tokens: { parentToken?: string; currentDeviceToken?: string } = {},
) {
  const [child] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, auth.familyId), isNull(children.archivedAt)));
  if (!child) throw notFound();
  await deleteSession(db, tokens.parentToken);
  await deleteSession(db, tokens.currentDeviceToken);
  const session = await createSession(db, "device", auth.familyId, clock, { deviceChildId: child.id });
  logSecurityEvent("device_enabled", { familyId: auth.familyId, parentId: auth.parentId, detail: "personal", childId: child.id });
  return session;
}

/**
 * Các thiết bị đang bật chế độ gia đình hoặc máy riêng (không trả token, chỉ mã nhận diện ngắn).
 * `childName` có giá trị với máy riêng.
 */
export async function listDevices(db: DbOrTx, familyId: number, clock: Clock = systemClock) {
  const rows = await db
    .select({ idHash: sessions.idHash, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, childId: sessions.deviceChildId, childName: children.name })
    .from(sessions)
    .leftJoin(children, eq(children.id, sessions.deviceChildId))
    .where(and(eq(sessions.subjectType, "device"), eq(sessions.subjectId, familyId)))
    .orderBy(asc(sessions.createdAt));
  const now = clock.now().getTime();
  return rows
    .filter((r) => r.expiresAt.getTime() > now)
    .map((r) => ({
      id: r.idHash.slice(0, 12),
      kind: r.childId === null ? ("shared" as const) : ("personal" as const),
      childName: r.childName,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
}

/** Thu hồi một thiết bị theo mã nhận diện ngắn. Phiên con trên thiết bị đó mất hiệu lực vì cần phiên thiết bị. */
export async function revokeDevice(db: DbOrTx, auth: { parentId: number; familyId: number }, deviceId: string): Promise<void> {
  if (!/^[0-9a-f]{12}$/.test(deviceId)) throw notFound();
  const rows = await db
    .select({ idHash: sessions.idHash })
    .from(sessions)
    .where(and(eq(sessions.subjectType, "device"), eq(sessions.subjectId, auth.familyId)));
  const target = rows.find((r) => r.idHash.startsWith(deviceId));
  if (!target) throw notFound();
  await db.delete(sessions).where(eq(sessions.idHash, target.idHash));
  logSecurityEvent("device_revoked", { familyId: auth.familyId, parentId: auth.parentId });
}

/**
 * Avatar các con (chưa lưu trữ) được đăng nhập trên thiết bị, kèm trạng thái khóa PIN.
 * Máy riêng (`childId` khác null) chỉ có con sở hữu máy.
 */
export async function listKidsForDevice(db: DbOrTx, device: { familyId: number; childId: number | null }, clock: Clock = systemClock) {
  const conditions = [eq(children.familyId, device.familyId), isNull(children.archivedAt)];
  if (device.childId !== null) conditions.push(eq(children.id, device.childId));
  const rows = await db
    .select({ id: children.id, name: children.name, avatar: children.avatar, theme: children.theme, lockedUntil: children.lockedUntil })
    .from(children)
    .where(and(...conditions))
    .orderBy(asc(children.id));
  const now = clock.now().getTime();
  return rows.map((r) => ({ ...r, locked: !!r.lockedUntil && r.lockedUntil.getTime() > now }));
}

/** Ghi một lần sai PIN trên dòng con đã khóa (`FOR UPDATE`): tới lần thứ 5 thì khóa 5 phút. */
async function recordPinFailure(tx: DbOrTx, child: { id: number; failedPinCount: number }, now: Date): Promise<"just_locked" | "wrong"> {
  const failures = child.failedPinCount + 1;
  if (failures >= PIN_MAX_FAILURES) {
    await tx.update(children).set({ failedPinCount: 0, lockedUntil: new Date(now.getTime() + PIN_LOCK_MS) }).where(eq(children.id, child.id));
    return "just_locked";
  }
  await tx.update(children).set({ failedPinCount: failures }).where(eq(children.id, child.id));
  return "wrong";
}

/**
 * Con chọn avatar và nhập PIN. Sai 5 lần liên tiếp thì khóa 5 phút. Bộ đếm nằm trên dòng `children`
 * và được cập nhật trong transaction có khóa dòng, nên hai lần nhập đồng thời không làm đếm sai.
 */
export async function loginChildWithPin(
  db: Db,
  input: { familyId: number; childId: number; pin: string; deviceChildId?: number | null },
  clock: Clock = systemClock,
): Promise<{ token: string; expiresAt: Date; browserSession: boolean }> {
  // Máy riêng chỉ cho con sở hữu máy đăng nhập. Từ chối trước khi đụng tới dòng của con kia, nên
  // không tăng bộ đếm sai PIN của con đó (máy của Bin không làm khóa được Na).
  const personal = input.deviceChildId !== undefined && input.deviceChildId !== null;
  if (personal && input.deviceChildId !== input.childId) throw notFound();
  const outcome = await db.transaction(async (tx) => {
    const [child] = await tx
      .select()
      .from(children)
      .where(and(eq(children.id, input.childId), eq(children.familyId, input.familyId), isNull(children.archivedAt)))
      .for("update");
    if (!child) throw notFound();
    const now = clock.now();
    if (child.lockedUntil && child.lockedUntil.getTime() > now.getTime()) {
      const minutes = Math.ceil((child.lockedUntil.getTime() - now.getTime()) / MINUTE);
      return { kind: "locked" as const, minutes };
    }
    if (await verifySecret(child.pinHash, input.pin)) {
      await tx.update(children).set({ failedPinCount: 0, lockedUntil: null }).where(eq(children.id, child.id));
      const session = await createSession(tx, "child", child.id, clock, personal ? { ttlMs: PERSONAL_CHILD_TTL_MS } : {});
      return { kind: "ok" as const, session: { ...session, browserSession: personal } };
    }
    return { kind: await recordPinFailure(tx, child, now) };
  });

  switch (outcome.kind) {
    case "ok":
      return outcome.session;
    case "locked":
      throw new DomainError("LOCKED", pinLockedMessage(outcome.minutes), { minutes: outcome.minutes });
    case "just_locked":
      logSecurityEvent("pin_locked", { familyId: input.familyId, childId: input.childId });
      throw new DomainError("LOCKED", pinLockedMessage(PIN_LOCK_MS / MINUTE), { minutes: PIN_LOCK_MS / MINUTE });
    case "wrong":
      logSecurityEvent("pin_failed", { familyId: input.familyId, childId: input.childId });
      throw new DomainError("INVALID_CREDENTIALS", PIN_WRONG_MESSAGE);
  }
}

/** Con bấm "Thoát": kết thúc phiên con, thiết bị quay về màn chọn avatar. */
export function logoutChild(db: DbOrTx, childToken: string | undefined): Promise<void> {
  return deleteSession(db, childToken);
}

export const PIN_CURRENT_WRONG_MESSAGE = "PIN hiện tại chưa đúng, con thử lại nhé";

/**
 * Con tự đổi PIN (spec "Con đổi PIN", design D4): cần đúng PIN hiện tại; sai thì tính vào bộ đếm khóa
 * như đăng nhập. PIN mới đúng 4 chữ số, khác PIN cũ, hai lần nhập giống nhau. Phiên hiện có giữ nguyên.
 */
export async function changeChildPin(
  db: Db,
  kid: { familyId: number; childId: number },
  input: { currentPin: string; newPin: string; confirmPin: string },
  clock: Clock = systemClock,
): Promise<void> {
  validatePin(input.newPin);
  if (input.newPin !== input.confirmPin) throw invalid("Hai lần nhập PIN mới chưa giống nhau");
  const newHash = await hashSecret(input.newPin);
  const outcome = await db.transaction(async (tx) => {
    const [child] = await tx
      .select()
      .from(children)
      .where(and(eq(children.id, kid.childId), eq(children.familyId, kid.familyId), isNull(children.archivedAt)))
      .for("update");
    if (!child) throw notFound();
    const now = clock.now();
    if (child.lockedUntil && child.lockedUntil.getTime() > now.getTime()) {
      return { kind: "locked" as const, minutes: Math.ceil((child.lockedUntil.getTime() - now.getTime()) / MINUTE) };
    }
    if (!(await verifySecret(child.pinHash, input.currentPin))) return { kind: await recordPinFailure(tx, child, now) };
    if (input.newPin === input.currentPin) return { kind: "same" as const };
    await tx.update(children).set({ pinHash: newHash, pinChangedAt: now, failedPinCount: 0, lockedUntil: null }).where(eq(children.id, child.id));
    return { kind: "ok" as const };
  });

  switch (outcome.kind) {
    case "ok":
      logSecurityEvent("pin_changed", { familyId: kid.familyId, childId: kid.childId });
      return;
    case "same":
      throw invalid("PIN mới phải khác PIN hiện tại");
    case "locked":
      throw new DomainError("LOCKED", pinLockedMessage(outcome.minutes), { minutes: outcome.minutes });
    case "just_locked":
      logSecurityEvent("pin_locked", { familyId: kid.familyId, childId: kid.childId });
      throw new DomainError("LOCKED", pinLockedMessage(PIN_LOCK_MS / MINUTE), { minutes: PIN_LOCK_MS / MINUTE });
    case "wrong":
      logSecurityEvent("pin_failed", { familyId: kid.familyId, childId: kid.childId, detail: "change_pin" });
      throw new DomainError("INVALID_CREDENTIALS", PIN_CURRENT_WRONG_MESSAGE);
  }
}
