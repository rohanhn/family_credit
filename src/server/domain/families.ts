import { and, eq, isNull } from "drizzle-orm";
import { systemClock, type Clock, DAY } from "../clock";
import { families, invites, parents } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { hit, LIMITS, peek } from "../auth/rate-limit";
import { randomToken, sha256 } from "../auth/crypto";
import { logSecurityEvent } from "../log";
import { DomainError, invalid, notFound } from "./errors";

// Gia đình và lời mời bố mẹ (spec family-accounts "Tạo gia đình", "Mời bố mẹ khác").

export const INVITE_TTL_MS = 7 * DAY;

export type Family = typeof families.$inferSelect;

function normalizeFamilyName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if ([...n].length < 1 || [...n].length > 50) throw invalid("Tên gia đình phải dài từ 1 đến 50 ký tự");
  return n;
}

/** Bố mẹ chưa thuộc gia đình nào tạo gia đình và trở thành bố mẹ của gia đình đó. */
export async function createFamily(db: Db, parentId: number, input: { name: string }): Promise<Family> {
  const name = normalizeFamilyName(input.name);
  return db.transaction(async (tx) => {
    const [parent] = await tx.select({ familyId: parents.familyId }).from(parents).where(eq(parents.id, parentId)).for("update");
    if (!parent) throw notFound();
    if (parent.familyId !== null) throw new DomainError("CONFLICT", "Tài khoản này đã thuộc một gia đình");
    const [family] = await tx.insert(families).values({ name }).returning();
    await tx.update(parents).set({ familyId: family.id }).where(eq(parents.id, parentId));
    return family;
  });
}

export async function getFamily(db: DbOrTx, familyId: number): Promise<Family> {
  const [family] = await db.select().from(families).where(eq(families.id, familyId));
  if (!family) throw notFound();
  return family;
}

/** Tạo liên kết mời dùng một lần, hạn 7 ngày; mỗi gia đình tối đa 10 lời mời mỗi ngày. */
export async function createInvite(
  db: Db,
  auth: { parentId: number; familyId: number },
  clock: Clock = systemClock,
): Promise<{ token: string; expiresAt: Date }> {
  const key = `invite:family:${auth.familyId}`;
  if ((await peek(db, key, LIMITS.inviteFamily.windowMs, clock)) >= LIMITS.inviteFamily.max) {
    throw new DomainError("RATE_LIMITED", "Đã tạo đủ 10 lời mời hôm nay, thử lại vào ngày mai");
  }
  const token = randomToken();
  const expiresAt = new Date(clock.now().getTime() + INVITE_TTL_MS);
  await db.transaction(async (tx) => {
    await tx.insert(invites).values({ familyId: auth.familyId, createdByParentId: auth.parentId, tokenHash: sha256(token), expiresAt });
    await hit(tx, key, LIMITS.inviteFamily.windowMs, clock);
  });
  logSecurityEvent("invite_created", { familyId: auth.familyId, parentId: auth.parentId });
  return { token, expiresAt };
}

export type InviteStatus = { valid: true; familyName: string } | { valid: false };

/** Kiểm tra lời mời trước khi chấp nhận (không tiết lộ lý do cụ thể). */
export async function inspectInvite(db: DbOrTx, token: string, clock: Clock = systemClock): Promise<InviteStatus> {
  const [row] = await db
    .select({ usedAt: invites.usedAt, expiresAt: invites.expiresAt, familyName: families.name })
    .from(invites)
    .innerJoin(families, eq(families.id, invites.familyId))
    .where(eq(invites.tokenHash, sha256(token)));
  if (!row || row.usedAt || row.expiresAt.getTime() <= clock.now().getTime()) return { valid: false };
  return { valid: true, familyName: row.familyName };
}

export const INVITE_INVALID_MESSAGE = "Lời mời không còn hiệu lực";

/** Tài khoản bố mẹ chưa có gia đình chấp nhận lời mời còn hạn; liên kết hết hiệu lực ngay. */
export async function acceptInvite(db: Db, parentId: number, token: string, clock: Clock = systemClock): Promise<{ familyId: number }> {
  const result = await db.transaction(async (tx) => {
    const [parent] = await tx.select({ familyId: parents.familyId }).from(parents).where(eq(parents.id, parentId)).for("update");
    if (!parent) throw notFound();
    if (parent.familyId !== null) throw new DomainError("CONFLICT", "Tài khoản này đã thuộc một gia đình");
    const now = clock.now();
    // Chuyển used_at có điều kiện: hai người bấm cùng lúc thì chỉ một người dùng được.
    const [invite] = await tx
      .update(invites)
      .set({ usedAt: now, usedByParentId: parentId })
      .where(and(eq(invites.tokenHash, sha256(token)), isNull(invites.usedAt)))
      .returning({ familyId: invites.familyId, expiresAt: invites.expiresAt });
    if (!invite || invite.expiresAt.getTime() <= now.getTime()) throw new DomainError("CONFLICT", INVITE_INVALID_MESSAGE);
    await tx.update(parents).set({ familyId: invite.familyId }).where(eq(parents.id, parentId));
    return { familyId: invite.familyId };
  });
  logSecurityEvent("invite_accepted", { familyId: result.familyId, parentId });
  return result;
}

/** Danh sách bố mẹ trong gia đình (dùng cho cài đặt). */
export function listParents(db: DbOrTx, familyId: number) {
  return db.select({ id: parents.id, displayName: parents.displayName, email: parents.email }).from(parents).where(eq(parents.familyId, familyId));
}
