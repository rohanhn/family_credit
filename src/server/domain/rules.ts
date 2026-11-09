import { and, asc, eq } from "drizzle-orm";
import { rules, RULE_KINDS } from "../db/schema";
import type { Db, DbOrTx } from "../db/types";
import { invalid, notFound } from "./errors";
import { recordTransaction, type Transaction } from "./ledger";

// Rule thưởng/phạt và thưởng/phạt đột xuất (spec reward-rules).

export type Rule = typeof rules.$inferSelect;
export type RuleKind = (typeof RULE_KINDS)[number];

export const POINTS_MESSAGE = "Số điểm phải là số nguyên dương";

export function validatePoints(points: number): number {
  if (!Number.isInteger(points) || points <= 0 || points > 100_000) throw invalid(POINTS_MESSAGE);
  return points;
}

function validateKind(kind: string): RuleKind {
  if (!(RULE_KINDS as readonly string[]).includes(kind)) throw invalid("Loại rule phải là thưởng hoặc phạt");
  return kind as RuleKind;
}

function normalizeName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if ([...n].length < 1 || [...n].length > 60) throw invalid("Tên phải dài từ 1 đến 60 ký tự");
  return n;
}

export async function createRule(db: DbOrTx, familyId: number, input: { name: string; kind: string; points: number; icon?: string | null }): Promise<Rule> {
  const [rule] = await db
    .insert(rules)
    .values({ familyId, name: normalizeName(input.name), kind: validateKind(input.kind), points: validatePoints(input.points), icon: input.icon || null })
    .returning();
  return rule;
}

/** Sửa rule chỉ áp dụng cho các lần áp dụng sau; giao dịch cũ đã chụp tên và điểm. */
export async function updateRule(
  db: DbOrTx,
  familyId: number,
  ruleId: number,
  input: { name?: string; kind?: string; points?: number; icon?: string | null },
): Promise<Rule> {
  const patch: Partial<typeof rules.$inferInsert> = {};
  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.kind !== undefined) patch.kind = validateKind(input.kind);
  if (input.points !== undefined) patch.points = validatePoints(input.points);
  if (input.icon !== undefined) patch.icon = input.icon || null;
  const [rule] = await db.update(rules).set(patch).where(and(eq(rules.id, ruleId), eq(rules.familyId, familyId))).returning();
  if (!rule) throw notFound();
  return rule;
}

/** Ẩn rule (không hiện khi áp dụng, vẫn được giữ) hoặc hiện lại. */
export async function setRuleHidden(db: DbOrTx, familyId: number, ruleId: number, hidden: boolean): Promise<Rule> {
  const [rule] = await db.update(rules).set({ hidden }).where(and(eq(rules.id, ruleId), eq(rules.familyId, familyId))).returning();
  if (!rule) throw notFound();
  return rule;
}

export async function listRules(db: DbOrTx, familyId: number, opts: { includeHidden?: boolean } = {}): Promise<Rule[]> {
  const conditions = [eq(rules.familyId, familyId)];
  if (!opts.includeHidden) conditions.push(eq(rules.hidden, false));
  return db.select().from(rules).where(and(...conditions)).orderBy(asc(rules.kind), asc(rules.points), asc(rules.id));
}

/** Rule đang hiện của gia đình, hoặc NOT_FOUND (rule ẩn không áp dụng/khai được). */
export async function getVisibleRule(db: DbOrTx, familyId: number, ruleId: number): Promise<Rule> {
  const [rule] = await db.select().from(rules).where(and(eq(rules.id, ruleId), eq(rules.familyId, familyId), eq(rules.hidden, false)));
  if (!rule) throw notFound("Rule không còn hiện");
  return rule;
}

/** Áp dụng một rule đang hiện cho một con: ghi giao dịch loại "rule", chụp tên và điểm lúc áp dụng. */
export async function applyRule(
  db: Db,
  input: { familyId: number; actorParentId: number; childId: number; ruleId: number; note?: string },
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const rule = await getVisibleRule(tx, input.familyId, input.ruleId);
    const note = input.note?.trim();
    return recordTransaction(tx, {
      familyId: input.familyId,
      childId: input.childId,
      kind: "rule",
      amount: rule.kind === "reward" ? rule.points : -rule.points,
      description: note ? `${rule.name} (${note})` : rule.name,
      actorParentId: input.actorParentId,
      refType: "rule",
      refId: rule.id,
      notifyTitle: rule.name,
    });
  });
}

export const REASON_REQUIRED_MESSAGE = "Cần nhập lý do";

/** Thưởng/phạt đột xuất: số điểm nguyên dương và lý do bắt buộc, ghi giao dịch loại "đột xuất". */
export async function applyAdhoc(
  db: Db,
  input: { familyId: number; actorParentId: number; childId: number; kind: string; points: number; reason: string },
): Promise<Transaction> {
  const kind = validateKind(input.kind);
  const points = validatePoints(input.points);
  const reason = input.reason.trim().replace(/\s+/g, " ");
  if (!reason) throw invalid(REASON_REQUIRED_MESSAGE);
  if ([...reason].length > 200) throw invalid("Lý do tối đa 200 ký tự");
  return db.transaction((tx) =>
    recordTransaction(tx, {
      familyId: input.familyId,
      childId: input.childId,
      kind: "adhoc",
      amount: kind === "reward" ? points : -points,
      description: reason,
      actorParentId: input.actorParentId,
    }),
  );
}
