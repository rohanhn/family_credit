import { and, asc, count, desc, eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { adhocProposals, children, RULE_KINDS } from "../db/schema";
import type { Db, DbOrTx, Tx } from "../db/types";
import { DomainError, invalid, notFound } from "./errors";
import { lockChild, recordTransaction, type Transaction } from "./ledger";
import { notifyRejected } from "./notifications";
import { ALREADY_DECIDED_MESSAGE } from "./rule-claims";
import { validatePoints, type RuleKind } from "./rules";

// Con đề xuất thưởng/phạt ngoài rule, bố mẹ duyệt (spec reward-rules "Con đề xuất thưởng/phạt ngoài rule",
// "Giới hạn đề xuất ngoài rule đang chờ", "Bố mẹ duyệt đề xuất ngoài rule").

export type AdhocProposal = typeof adhocProposals.$inferSelect;

/** Số đề xuất ngoài rule đang chờ duyệt tối đa của mỗi con, tính chung cả xin thưởng và tự nhận phạt. */
export const MAX_PENDING_PROPOSALS = 5;

export const DESCRIPTION_REQUIRED_MESSAGES: Record<RuleKind, string> = {
  reward: "Con cần viết việc con đã làm",
  penalty: "Con cần viết lỗi con đã mắc",
};
export const PENDING_LIMIT_MESSAGE = `Con đang có ${MAX_PENDING_PROPOSALS} đề xuất chờ bố mẹ duyệt. Chờ bố mẹ duyệt bớt hoặc hủy một đề xuất rồi gửi tiếp nhé.`;

function validateKind(kind: string): RuleKind {
  if (!(RULE_KINDS as readonly string[]).includes(kind)) throw invalid("Loại đề xuất phải là xin thưởng hoặc nhận phạt");
  return kind as RuleKind;
}

function normalizeDescription(description: string, kind: RuleKind): string {
  const d = description.trim().replace(/\s+/g, " ");
  if (!d) throw invalid(DESCRIPTION_REQUIRED_MESSAGES[kind]);
  if ([...d].length > 200) throw invalid("Mô tả tối đa 200 ký tự");
  return d;
}

/**
 * Con gửi đề xuất: tạo ở trạng thái chờ duyệt, không đổi số dư.
 * Khóa dòng của con rồi mới đếm, để hai lần gửi đồng thời không cùng vượt giới hạn.
 */
export async function createProposal(
  db: Db,
  input: { familyId: number; childId: number; kind: string; description: string; points: number },
): Promise<AdhocProposal> {
  const kind = validateKind(input.kind);
  const description = normalizeDescription(input.description, kind);
  const proposedPoints = validatePoints(input.points);
  return db.transaction(async (tx) => {
    await lockChild(tx, input.familyId, input.childId);
    const [{ pending }] = await tx
      .select({ pending: count() })
      .from(adhocProposals)
      .where(and(eq(adhocProposals.childId, input.childId), eq(adhocProposals.status, "pending")));
    if (pending >= MAX_PENDING_PROPOSALS) throw new DomainError("CONFLICT", PENDING_LIMIT_MESSAGE);
    const [proposal] = await tx.insert(adhocProposals).values({ childId: input.childId, kind, description, proposedPoints }).returning();
    return proposal;
  });
}

/** Con hủy đề xuất còn chờ duyệt của chính mình. */
export async function cancelProposal(db: DbOrTx, input: { childId: number; proposalId: number }, clock: Clock = systemClock): Promise<void> {
  const rows = await db
    .update(adhocProposals)
    .set({ status: "cancelled", decidedAt: clock.now() })
    .where(and(eq(adhocProposals.id, input.proposalId), eq(adhocProposals.childId, input.childId), eq(adhocProposals.status, "pending")))
    .returning({ id: adhocProposals.id });
  if (rows.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
}

export function listChildProposals(db: DbOrTx, childId: number, status: AdhocProposal["status"] = "pending") {
  return db
    .select()
    .from(adhocProposals)
    .where(and(eq(adhocProposals.childId, childId), eq(adhocProposals.status, status)))
    .orderBy(desc(adhocProposals.id));
}

/** Đề xuất ngoài rule đang chờ của cả gia đình (cho hàng chờ duyệt chung). */
export async function listPendingProposals(db: DbOrTx, familyId: number) {
  const rows = await db
    .select({ proposal: adhocProposals, childName: children.name, childArchivedAt: children.archivedAt })
    .from(adhocProposals)
    .innerJoin(children, eq(children.id, adhocProposals.childId))
    .where(and(eq(children.familyId, familyId), eq(adhocProposals.status, "pending")))
    .orderBy(asc(adhocProposals.id));
  return rows.map((r) => ({ ...r.proposal, childName: r.childName, childArchived: r.childArchivedAt !== null }));
}

/** Khóa đề xuất của gia đình trong transaction; NOT_FOUND nếu thuộc gia đình khác. */
async function lockProposal(tx: Tx, familyId: number, proposalId: number) {
  const [row] = await tx
    .select({ proposal: adhocProposals })
    .from(adhocProposals)
    .innerJoin(children, eq(children.id, adhocProposals.childId))
    .where(and(eq(adhocProposals.id, proposalId), eq(children.familyId, familyId)))
    .for("update", { of: adhocProposals });
  if (!row) throw notFound();
  return row.proposal;
}

/**
 * Duyệt: chuyển pending → approved có điều kiện, lưu số điểm bố mẹ chốt và ghi giao dịch "đột xuất" trong một transaction.
 * Bỏ trống `points` thì giữ số con đề xuất. Số điểm không hợp lệ thì transaction hủy, đề xuất vẫn chờ duyệt.
 */
export async function approveProposal(
  db: Db,
  input: { familyId: number; actorParentId: number; proposalId: number; points?: number },
  clock: Clock = systemClock,
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.familyId, input.proposalId);
    const points = input.points === undefined ? proposal.proposedPoints : validatePoints(input.points);
    const updated = await tx
      .update(adhocProposals)
      .set({ status: "approved", approvedPoints: points, decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(adhocProposals.id, proposal.id), eq(adhocProposals.status, "pending")))
      .returning({ id: adhocProposals.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    return recordTransaction(tx, {
      familyId: input.familyId,
      childId: proposal.childId,
      kind: "adhoc",
      amount: proposal.kind === "reward" ? points : -points,
      description: proposal.description,
      actorParentId: input.actorParentId,
      refType: "adhoc_proposal",
      refId: proposal.id,
      allowArchived: true,
      notifyTitle: proposal.description,
    });
  });
}

/** Từ chối kèm lý do tùy chọn: không ghi giao dịch, con nhận thông báo "bị từ chối". */
export async function rejectProposal(
  db: Db,
  input: { familyId: number; actorParentId: number; proposalId: number; reason?: string },
  clock: Clock = systemClock,
): Promise<void> {
  await db.transaction(async (tx) => {
    const proposal = await lockProposal(tx, input.familyId, input.proposalId);
    const reason = input.reason?.trim() || null;
    const updated = await tx
      .update(adhocProposals)
      .set({ status: "rejected", reason, decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(adhocProposals.id, proposal.id), eq(adhocProposals.status, "pending")))
      .returning({ id: adhocProposals.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    await notifyRejected(tx, { childId: proposal.childId, title: proposal.description, reason, refType: "adhoc_proposal", refId: proposal.id });
  });
}
