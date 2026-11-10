import { and, asc, desc, eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { children, ruleClaims } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { DomainError, invalid, notFound } from "./errors";
import { recordTransaction, type Transaction } from "./ledger";
import { notifyRejected } from "./notifications";
import { getVisibleRule } from "./rules";

// Con khai đã làm rule thưởng, bố mẹ duyệt (spec reward-rules "Con khai rule thưởng", "Bố mẹ duyệt khai rule").

export type RuleClaim = typeof ruleClaims.$inferSelect;

export const ALREADY_DECIDED_MESSAGE = "Yêu cầu này đã được xử lý";

/** Con khai một rule thưởng đang hiện: tạo yêu cầu chờ duyệt, chụp tên và điểm, không cộng điểm. */
export async function createClaim(
  db: DbOrTx,
  input: { familyId: number; childId: number; ruleId: number; note?: string },
): Promise<RuleClaim> {
  const rule = await getVisibleRule(db, input.familyId, input.ruleId);
  if (rule.kind !== "reward") throw new DomainError("FORBIDDEN", "Chỉ khai được rule thưởng");
  const note = input.note?.trim().replace(/\s+/g, " ") || null;
  if (note && [...note].length > 200) throw invalid("Ghi chú tối đa 200 ký tự");
  const [claim] = await db
    .insert(ruleClaims)
    .values({ childId: input.childId, ruleId: rule.id, nameSnapshot: rule.name, pointsSnapshot: rule.points, note })
    .returning();
  return claim;
}

/** Con hủy yêu cầu còn chờ duyệt của chính mình. */
export async function cancelClaim(db: DbOrTx, input: { childId: number; claimId: number }, clock: Clock = systemClock): Promise<void> {
  const rows = await db
    .update(ruleClaims)
    .set({ status: "cancelled", decidedAt: clock.now() })
    .where(and(eq(ruleClaims.id, input.claimId), eq(ruleClaims.childId, input.childId), eq(ruleClaims.status, "pending")))
    .returning({ id: ruleClaims.id });
  if (rows.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
}

export function listChildClaims(db: DbOrTx, childId: number, status: RuleClaim["status"] = "pending") {
  return db.select().from(ruleClaims).where(and(eq(ruleClaims.childId, childId), eq(ruleClaims.status, status))).orderBy(desc(ruleClaims.id));
}

/** Yêu cầu khai rule đang chờ của cả gia đình (cho hàng chờ duyệt chung). */
export async function listPendingClaims(db: DbOrTx, familyId: number) {
  const rows = await db
    .select({ claim: ruleClaims, childName: children.name, childArchivedAt: children.archivedAt })
    .from(ruleClaims)
    .innerJoin(children, eq(children.id, ruleClaims.childId))
    .where(and(eq(children.familyId, familyId), eq(ruleClaims.status, "pending")))
    .orderBy(asc(ruleClaims.id));
  return rows.map((r) => ({ ...r.claim, childName: r.childName, childArchived: r.childArchivedAt !== null }));
}

/** Khóa yêu cầu của gia đình trong transaction; NOT_FOUND nếu thuộc gia đình khác. */
async function lockClaim(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], familyId: number, claimId: number) {
  const [row] = await tx
    .select({ claim: ruleClaims })
    .from(ruleClaims)
    .innerJoin(children, eq(children.id, ruleClaims.childId))
    .where(and(eq(ruleClaims.id, claimId), eq(children.familyId, familyId)))
    .for("update", { of: ruleClaims });
  if (!row) throw notFound();
  return row.claim;
}

/** Duyệt: chuyển pending → approved có điều kiện và ghi giao dịch theo điểm đã chụp, trong một transaction. */
export async function approveClaim(
  db: Db,
  input: { familyId: number; actorParentId: number; claimId: number },
  clock: Clock = systemClock,
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const claim = await lockClaim(tx, input.familyId, input.claimId);
    const updated = await tx
      .update(ruleClaims)
      .set({ status: "approved", decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(ruleClaims.id, claim.id), eq(ruleClaims.status, "pending")))
      .returning({ id: ruleClaims.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    return recordTransaction(tx, {
      familyId: input.familyId,
      childId: claim.childId,
      kind: "rule",
      amount: claim.pointsSnapshot,
      description: claim.note ? `${claim.nameSnapshot} (${claim.note})` : claim.nameSnapshot,
      actorParentId: input.actorParentId,
      refType: "rule_claim",
      refId: claim.id,
      allowArchived: true,
      notifyTitle: claim.nameSnapshot,
    });
  });
}

/** Từ chối kèm lý do tùy chọn: không ghi giao dịch, con nhận thông báo "bị từ chối". */
export async function rejectClaim(
  db: Db,
  input: { familyId: number; actorParentId: number; claimId: number; reason?: string },
  clock: Clock = systemClock,
): Promise<void> {
  await db.transaction(async (tx) => {
    const claim = await lockClaim(tx, input.familyId, input.claimId);
    const reason = input.reason?.trim() || null;
    const updated = await tx
      .update(ruleClaims)
      .set({ status: "rejected", reason, decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(ruleClaims.id, claim.id), eq(ruleClaims.status, "pending")))
      .returning({ id: ruleClaims.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    await notifyRejected(tx, { childId: claim.childId, title: claim.nameSnapshot, reason, refType: "rule_claim", refId: claim.id });
  });
}
