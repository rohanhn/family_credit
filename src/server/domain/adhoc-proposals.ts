import { and, asc, count, desc, eq } from "drizzle-orm";
import { systemClock, type Clock } from "../clock";
import { adhocProposals, children, RULE_KINDS } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { DomainError, invalid } from "./errors";
import { lockChild } from "./ledger";
import { ALREADY_DECIDED_MESSAGE } from "./rule-claims";
import { validatePoints, type RuleKind } from "./rules";

// Con đề xuất thưởng/phạt ngoài rule, bố mẹ duyệt
// (spec reward-rules "Con đề xuất thưởng/phạt ngoài rule", "Giới hạn đề xuất ngoài rule đang chờ").

export type AdhocProposal = typeof adhocProposals.$inferSelect;

/** Số đề xuất ngoài rule đang chờ duyệt tối đa của mỗi con, tính chung cả xin thưởng và tự nhận phạt. */
export const MAX_PENDING_PROPOSALS = 5;

export const DESCRIPTION_REQUIRED_MESSAGE = "Con hãy kể việc con đã làm";
export const PENDING_LIMIT_MESSAGE = `Con đang có ${MAX_PENDING_PROPOSALS} đề xuất chờ bố mẹ duyệt. Chờ bố mẹ duyệt bớt hoặc hủy một đề xuất rồi gửi tiếp nhé.`;

function validateKind(kind: string): RuleKind {
  if (!(RULE_KINDS as readonly string[]).includes(kind)) throw invalid("Loại đề xuất phải là xin thưởng hoặc nhận phạt");
  return kind as RuleKind;
}

function normalizeDescription(description: string): string {
  const d = description.trim().replace(/\s+/g, " ");
  if (!d) throw invalid(DESCRIPTION_REQUIRED_MESSAGE);
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
  const description = normalizeDescription(input.description);
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
