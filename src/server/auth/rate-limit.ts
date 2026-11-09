import { and, eq, gt, lt, sql } from "drizzle-orm";
import { systemClock, type Clock, DAY, HOUR, MINUTE } from "../clock";
import { authAttempts } from "../db/schema";
import type { DbOrTx } from "../db/types";

// Bộ đếm cửa sổ cố định trong bảng auth_attempts (design D9). Tăng bằng một câu
// INSERT ... ON CONFLICT ... RETURNING nên đúng cả khi nhiều request đồng thời.

export const LIMITS = {
  loginEmailFailures: { max: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  loginIp: { max: 20, windowMs: 15 * MINUTE },
  signupIp: { max: 5, windowMs: HOUR },
  inviteFamily: { max: 10, windowMs: DAY },
} as const;

function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/** Tăng bộ đếm của cửa sổ hiện tại, trả về số đếm sau khi tăng. */
export async function hit(db: DbOrTx, key: string, windowMs: number, clock: Clock = systemClock): Promise<number> {
  const [row] = await db
    .insert(authAttempts)
    .values({ key, windowStart: windowStart(clock.now(), windowMs), count: 1 })
    .onConflictDoUpdate({ target: [authAttempts.key, authAttempts.windowStart], set: { count: sql`${authAttempts.count} + 1` } })
    .returning({ count: authAttempts.count });
  return row.count;
}

/** Số đếm của cửa sổ hiện tại, không tăng. */
export async function peek(db: DbOrTx, key: string, windowMs: number, clock: Clock = systemClock): Promise<number> {
  const [row] = await db
    .select({ count: authAttempts.count })
    .from(authAttempts)
    .where(and(eq(authAttempts.key, key), eq(authAttempts.windowStart, windowStart(clock.now(), windowMs))));
  return row?.count ?? 0;
}

export async function clear(db: DbOrTx, key: string): Promise<void> {
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}

/** Đặt khóa: một dòng có window_start = thời điểm khóa. */
export async function lock(db: DbOrTx, key: string, clock: Clock = systemClock): Promise<void> {
  await db.insert(authAttempts).values({ key, windowStart: clock.now(), count: 1 }).onConflictDoNothing();
}

/** Thời điểm hết khóa nếu đang bị khóa, ngược lại null. */
export async function lockedUntil(db: DbOrTx, key: string, lockMs: number, clock: Clock = systemClock): Promise<Date | null> {
  const since = new Date(clock.now().getTime() - lockMs);
  const [row] = await db
    .select({ at: sql<Date>`max(${authAttempts.windowStart})` })
    .from(authAttempts)
    .where(and(eq(authAttempts.key, key), gt(authAttempts.windowStart, since)));
  return row?.at ? new Date(new Date(row.at).getTime() + lockMs) : null;
}

/** Xóa các cửa sổ đã quá 1 ngày (chạy lúc khởi động). */
export async function cleanupAuthAttempts(db: DbOrTx, clock: Clock = systemClock): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - DAY);
  const rows = await db.delete(authAttempts).where(lt(authAttempts.windowStart, cutoff)).returning({ key: authAttempts.key });
  return rows.length;
}
