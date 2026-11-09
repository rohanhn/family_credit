import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { children, parents, transactions, TRANSACTION_KINDS } from "../db/schema";
import type { Db, DbOrTx, Tx } from "../db/types";
import { invalid, notFound } from "./errors";
import { notifyForTransaction } from "./notifications";

// Sổ cái chỉ ghi thêm (spec currency-ledger, design D2/D3).

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];
export type Transaction = typeof transactions.$inferSelect;

export type LedgerEntryInput = {
  familyId: number;
  childId: number;
  kind: TransactionKind;
  /** Mức gốc: dương là cộng, âm là trừ. */
  amount: number;
  description: string;
  actorParentId: number;
  refType?: string;
  refId?: number;
  /** Tiêu đề thông báo cho con, mặc định là description. */
  notifyTitle?: string;
};

/** Khóa dòng của con trong transaction (SELECT ... FOR UPDATE) để các thao tác ghi điểm trên cùng một con chạy lần lượt. */
export async function lockChild(tx: Tx, familyId: number, childId: number) {
  const [child] = await tx
    .select({ id: children.id, familyId: children.familyId, archivedAt: children.archivedAt })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)))
    .for("update");
  if (!child) throw notFound();
  return child;
}

/** Số dư = tổng applied_amount của con (spec "Số dư tính từ sổ cái"). */
export async function getBalance(db: DbOrTx, childId: number): Promise<number> {
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${transactions.appliedAmount}), 0)::int` })
    .from(transactions)
    .where(eq(transactions.childId, childId));
  return row?.balance ?? 0;
}

/** Mức thực ghi: khoản trừ chỉ trừ tối đa bằng số dư hiện có (spec "Số dư không âm"). */
export function appliedAmount(requested: number, balance: number): number {
  if (requested >= 0) return requested;
  return Math.max(requested, -balance);
}

/**
 * Ghi một giao dịch trong transaction đang mở: khóa dòng của con, tính mức thực ghi, INSERT,
 * rồi tạo thông báo cho con trong cùng transaction (design D3 "Thông báo").
 */
export async function recordTransaction(tx: Tx, input: LedgerEntryInput): Promise<Transaction> {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw invalid("Số điểm phải là số nguyên khác 0");
  const description = input.description.trim();
  if (!description) throw invalid("Thiếu mô tả giao dịch");

  await lockChild(tx, input.familyId, input.childId);
  const balance = await getBalance(tx, input.childId);
  const [row] = await tx
    .insert(transactions)
    .values({
      familyId: input.familyId,
      childId: input.childId,
      kind: input.kind,
      requestedAmount: input.amount,
      appliedAmount: appliedAmount(input.amount, balance),
      description,
      actorParentId: input.actorParentId,
      refType: input.refType,
      refId: input.refId,
    })
    .returning();
  await notifyForTransaction(tx, row, input.notifyTitle ?? description);
  return row;
}

/** Tiện ích: ghi một giao dịch trong transaction riêng. */
export function applyLedgerEntry(db: Db, input: LedgerEntryInput): Promise<Transaction> {
  return db.transaction((tx) => recordTransaction(tx, input));
}

/**
 * Giao dịch điều chỉnh tham chiếu một giao dịch trước đó kèm lý do (spec "Giao dịch điều chỉnh"):
 * đảo ngược mức thực ghi của giao dịch gốc, vẫn tuân theo quy tắc số dư không âm.
 */
export async function recordAdjustment(
  db: Db,
  input: { familyId: number; originalTransactionId: number; reason: string; actorParentId: number },
): Promise<Transaction> {
  const reason = input.reason.trim();
  if (!reason) throw invalid("Cần nhập lý do điều chỉnh");
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, input.originalTransactionId), eq(transactions.familyId, input.familyId)));
    if (!original) throw notFound();
    if (original.appliedAmount === 0) throw invalid("Giao dịch gốc không làm thay đổi số dư nên không cần điều chỉnh");
    return recordTransaction(tx, {
      familyId: input.familyId,
      childId: original.childId,
      kind: "adjust",
      amount: -original.appliedAmount,
      description: `Điều chỉnh "${original.description}": ${reason}`,
      actorParentId: input.actorParentId,
      refType: "transaction",
      refId: original.id,
    });
  });
}

export type TransactionView = Transaction & { childName: string; actorName: string };

/** Lịch sử giao dịch, mới nhất trước; lọc theo con, khoảng thời gian [from, to) và loại. */
export async function listTransactions(
  db: DbOrTx,
  filter: { familyId: number; childId?: number; from?: Date; to?: Date; kinds?: TransactionKind[]; limit?: number },
): Promise<TransactionView[]> {
  const conditions = [eq(transactions.familyId, filter.familyId)];
  if (filter.childId !== undefined) conditions.push(eq(transactions.childId, filter.childId));
  if (filter.from) conditions.push(gte(transactions.createdAt, filter.from));
  if (filter.to) conditions.push(lt(transactions.createdAt, filter.to));
  if (filter.kinds?.length) conditions.push(inArray(transactions.kind, filter.kinds));

  const rows = await db
    .select({ txn: transactions, childName: children.name, actorName: parents.displayName })
    .from(transactions)
    .innerJoin(children, eq(children.id, transactions.childId))
    .innerJoin(parents, eq(parents.id, transactions.actorParentId))
    .where(and(...conditions))
    .orderBy(desc(transactions.id))
    .limit(Math.min(filter.limit ?? 200, 500));
  return rows.map((r) => ({ ...r.txn, childName: r.childName, actorName: r.actorName }));
}
