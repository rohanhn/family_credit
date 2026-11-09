import { and, eq, ne } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { sessions } from "../db/schema";
import { SESSION_TTL_MS, SLIDING, type SessionSubject } from "./session-cookies";
import type { DbOrTx } from "../db/types";
import { randomToken, sha256 } from "./crypto";

// Phiên lưu trong DB, chỉ lưu SHA-256 của token (design D4).

export type { SessionSubject };
export { SESSION_TTL_MS };

export type SessionOptions = {
  /** Phiên device của máy riêng: con sở hữu máy. */
  deviceChildId?: number | null;
  /** Thời hạn thay cho mặc định của loại phiên (phiên con trên máy riêng). */
  ttlMs?: number;
};

export async function createSession(db: DbOrTx, subjectType: SessionSubject, subjectId: number, clock: Clock = systemClock, opts: SessionOptions = {}) {
  const token = randomToken();
  const expiresAt = new Date(clock.now().getTime() + (opts.ttlMs ?? SESSION_TTL_MS[subjectType]));
  await db.insert(sessions).values({ idHash: sha256(token), subjectType, subjectId, expiresAt, deviceChildId: opts.deviceChildId ?? null });
  return { token, expiresAt };
}

/**
 * Trả về phiên còn hạn đúng loại, hoặc null. Phiên hết hạn bị xóa; phiên trượt được gia hạn.
 * Phiên device của máy riêng cũng là phiên trượt. `ttlMs` thay thời hạn mặc định khi gia hạn.
 */
export async function resolveSession(
  db: DbOrTx,
  token: string | undefined,
  subjectType: SessionSubject,
  clock: Clock = systemClock,
  opts: { ttlMs?: number } = {},
) {
  if (!token) return null;
  const idHash = sha256(token);
  const [row] = await db.select().from(sessions).where(eq(sessions.idHash, idHash));
  if (!row || row.subjectType !== subjectType) return null;
  const now = clock.now().getTime();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  const ttl = opts.ttlMs ?? SESSION_TTL_MS[subjectType];
  const sliding = SLIDING[subjectType] || (subjectType === "device" && row.deviceChildId !== null);
  let expiresAt = row.expiresAt;
  // Gia hạn khi đã dùng hết hơn 10% thời hạn, để không ghi DB ở mọi request.
  if (sliding && row.expiresAt.getTime() - now < ttl * 0.9) {
    expiresAt = new Date(now + ttl);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.idHash, idHash));
  }
  return { idHash, subjectId: row.subjectId, deviceChildId: row.deviceChildId, expiresAt };
}

export async function deleteSession(db: DbOrTx, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.idHash, sha256(token)));
}

/** Xóa mọi phiên của một chủ thể, có thể chừa lại một phiên (phiên hiện tại khi đổi mật khẩu). */
export async function deleteSessionsFor(db: DbOrTx, subjectType: SessionSubject, subjectId: number, exceptIdHash?: string): Promise<number> {
  const conditions = [eq(sessions.subjectType, subjectType), eq(sessions.subjectId, subjectId)];
  if (exceptIdHash) conditions.push(ne(sessions.idHash, exceptIdHash));
  const rows = await db.delete(sessions).where(and(...conditions)).returning({ id: sessions.idHash });
  return rows.length;
}
