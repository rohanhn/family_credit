import { and, eq, isNull } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { children, families, parents } from "../db/schema";
import type { DbOrTx } from "../db/types";
import { resolveSession } from "./sessions";

// Lõi của guard (design D4): xác định ai đang thao tác từ token phiên. Mọi truy vấn domain
// nhận familyId/childId từ đây, không bao giờ từ input của người dùng.

export type ParentAuth = {
  kind: "parent";
  parentId: number;
  familyId: number | null;
  displayName: string;
  sessionIdHash: string;
};

export type DeviceAuth = { kind: "device"; familyId: number; sessionIdHash: string };

export type ChildAuth = {
  kind: "child";
  childId: number;
  familyId: number;
  name: string;
  avatar: string;
  theme: string | null;
  sessionIdHash: string;
};

export async function authenticateParent(db: DbOrTx, token: string | undefined, clock: Clock = systemClock): Promise<ParentAuth | null> {
  const session = await resolveSession(db, token, "parent", clock);
  if (!session) return null;
  const [p] = await db
    .select({ id: parents.id, familyId: parents.familyId, displayName: parents.displayName })
    .from(parents)
    .where(eq(parents.id, session.subjectId));
  if (!p) return null;
  return { kind: "parent", parentId: p.id, familyId: p.familyId, displayName: p.displayName, sessionIdHash: session.idHash };
}

/** Thiết bị đã bật chế độ gia đình: phiên `device` gắn với một gia đình. */
export async function authenticateDevice(db: DbOrTx, token: string | undefined, clock: Clock = systemClock): Promise<DeviceAuth | null> {
  const session = await resolveSession(db, token, "device", clock);
  if (!session) return null;
  const [f] = await db.select({ id: families.id }).from(families).where(eq(families.id, session.subjectId));
  if (!f) return null;
  return { kind: "device", familyId: f.id, sessionIdHash: session.idHash };
}

/**
 * Phiên con chỉ hợp lệ khi đi kèm phiên thiết bị của cùng gia đình, và con chưa bị lưu trữ.
 */
export async function authenticateChild(
  db: DbOrTx,
  deviceToken: string | undefined,
  childToken: string | undefined,
  clock: Clock = systemClock,
): Promise<ChildAuth | null> {
  const device = await authenticateDevice(db, deviceToken, clock);
  if (!device) return null;
  const session = await resolveSession(db, childToken, "child", clock);
  if (!session) return null;
  const [c] = await db
    .select({ id: children.id, familyId: children.familyId, name: children.name, avatar: children.avatar, theme: children.theme })
    .from(children)
    .where(and(eq(children.id, session.subjectId), eq(children.familyId, device.familyId), isNull(children.archivedAt)));
  if (!c) return null;
  return { kind: "child", childId: c.id, familyId: c.familyId, name: c.name, avatar: c.avatar, theme: c.theme, sessionIdHash: session.idHash };
}
