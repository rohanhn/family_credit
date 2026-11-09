import { and, asc, eq, isNull } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { children } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { hashSecret } from "../auth/crypto";
import { deleteSessionsFor } from "../auth/sessions";
import { isAvatarId } from "@/lib/avatars";
import { invalid, notFound } from "./errors";

// Hồ sơ con (spec family-accounts "Quản lý hồ sơ con").

export type Child = typeof children.$inferSelect;
export type ChildSummary = Pick<Child, "id" | "name" | "avatar" | "theme" | "archivedAt" | "goalRewardId">;

export const PIN_FORMAT_MESSAGE = "PIN phải gồm đúng 4 chữ số";

export function validatePin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw invalid(PIN_FORMAT_MESSAGE);
}

function normalizeChildName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if ([...n].length < 1 || [...n].length > 30) throw invalid("Tên phải dài từ 1 đến 30 ký tự");
  return n;
}

function validateAvatar(avatar: string): void {
  if (!isAvatarId(avatar)) throw invalid("Avatar không có trong bộ có sẵn");
}

export async function createChild(db: DbOrTx, familyId: number, input: { name: string; avatar: string; pin: string }): Promise<Child> {
  const name = normalizeChildName(input.name);
  validateAvatar(input.avatar);
  validatePin(input.pin);
  const [child] = await db
    .insert(children)
    .values({ familyId, name, avatar: input.avatar, pinHash: await hashSecret(input.pin) })
    .returning();
  return child;
}

export async function updateChild(
  db: DbOrTx,
  familyId: number,
  childId: number,
  input: { name?: string; avatar?: string; pin?: string },
): Promise<Child> {
  const patch: Partial<typeof children.$inferInsert> = {};
  if (input.name !== undefined) patch.name = normalizeChildName(input.name);
  if (input.avatar !== undefined) {
    validateAvatar(input.avatar);
    patch.avatar = input.avatar;
  }
  if (input.pin !== undefined && input.pin !== "") {
    validatePin(input.pin);
    patch.pinHash = await hashSecret(input.pin);
    patch.failedPinCount = 0;
    patch.lockedUntil = null;
  }
  const [child] = await db
    .update(children)
    .set(patch)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId), isNull(children.archivedAt)))
    .returning();
  if (!child) throw notFound();
  return child;
}

/** Lưu trữ: con không còn đăng nhập được và không hiện ở màn chọn avatar; lịch sử vẫn giữ. */
export async function archiveChild(db: Db, familyId: number, childId: number, clock: Clock = systemClock): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(children)
      .set({ archivedAt: clock.now() })
      .where(and(eq(children.id, childId), eq(children.familyId, familyId), isNull(children.archivedAt)))
      .returning({ id: children.id });
    if (rows.length === 0) throw notFound();
    await deleteSessionsFor(tx, "child", childId);
  });
}

export async function listChildren(db: DbOrTx, familyId: number, opts: { includeArchived?: boolean } = {}): Promise<ChildSummary[]> {
  const conditions = [eq(children.familyId, familyId)];
  if (!opts.includeArchived) conditions.push(isNull(children.archivedAt));
  return db
    .select({ id: children.id, name: children.name, avatar: children.avatar, theme: children.theme, archivedAt: children.archivedAt, goalRewardId: children.goalRewardId })
    .from(children)
    .where(and(...conditions))
    .orderBy(asc(children.id));
}

export async function getChild(db: DbOrTx, familyId: number, childId: number): Promise<Child> {
  const [child] = await db.select().from(children).where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  if (!child) throw notFound();
  return child;
}
