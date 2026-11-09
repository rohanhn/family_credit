import { and, eq, ne } from "drizzle-orm";
import { systemClock, type Clock, DAY, HOUR } from "../clock";
import { sessions, SESSION_SUBJECTS } from "../db/schema";
import type { DbOrTx } from "../db/types";
import { randomToken, sha256 } from "./crypto";

// Phiên lưu trong DB, chỉ lưu SHA-256 của token (design D4).

export type SessionSubject = (typeof SESSION_SUBJECTS)[number];

export const SESSION_TTL_MS: Record<SessionSubject, number> = {
  parent: 30 * DAY,
  device: 90 * DAY,
  child: 2 * HOUR,
};

/** Phiên bố mẹ và con được gia hạn khi còn dùng; phiên thiết bị có hạn cố định. */
const SLIDING: Record<SessionSubject, boolean> = { parent: true, device: false, child: true };

export async function createSession(db: DbOrTx, subjectType: SessionSubject, subjectId: number, clock: Clock = systemClock) {
  const token = randomToken();
  const expiresAt = new Date(clock.now().getTime() + SESSION_TTL_MS[subjectType]);
  await db.insert(sessions).values({ idHash: sha256(token), subjectType, subjectId, expiresAt });
  return { token, expiresAt };
}

/** Trả về phiên còn hạn đúng loại, hoặc null. Phiên hết hạn bị xóa; phiên trượt được gia hạn. */
export async function resolveSession(db: DbOrTx, token: string | undefined, subjectType: SessionSubject, clock: Clock = systemClock) {
  if (!token) return null;
  const idHash = sha256(token);
  const [row] = await db.select().from(sessions).where(eq(sessions.idHash, idHash));
  if (!row || row.subjectType !== subjectType) return null;
  const now = clock.now().getTime();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }
  const ttl = SESSION_TTL_MS[subjectType];
  let expiresAt = row.expiresAt;
  // Gia hạn khi đã dùng hết hơn 10% thời hạn, để không ghi DB ở mọi request.
  if (SLIDING[subjectType] && row.expiresAt.getTime() - now < ttl * 0.9) {
    expiresAt = new Date(now + ttl);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.idHash, idHash));
  }
  return { idHash, subjectId: row.subjectId, expiresAt };
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
