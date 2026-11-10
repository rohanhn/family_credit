import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { systemClock, type Clock, DAY } from "../clock";
import { notifications, parents, transactions } from "../db/schema";
import type { DbOrTx, Tx } from "../db/types";

// Thông báo cho con (spec kid-notifications, design D3 "Thông báo").
// Thông báo không phải sổ cái: được đánh dấu đọc và dọn sau 30 ngày.

export type Notification = typeof notifications.$inferSelect;
export type NotificationKind = Notification["kind"];

export const NOTIFICATION_RETENTION_DAYS = 30;

/** Loại thông báo của một giao dịch: duyệt đổi thưởng luôn là "nhận quà"; còn lại theo dấu. */
export function notificationKindFor(txn: Pick<typeof transactions.$inferSelect, "kind" | "requestedAmount" | "appliedAmount">): NotificationKind {
  if (txn.kind === "redeem") return "gift";
  if (txn.appliedAmount > 0) return "gift";
  return "penalty";
}

/** Gọi trong cùng transaction với việc ghi giao dịch, nên không có giao dịch nào thiếu thông báo. */
export async function notifyForTransaction(tx: Tx, txn: typeof transactions.$inferSelect, title: string): Promise<Notification> {
  const [row] = await tx
    .insert(notifications)
    .values({
      childId: txn.childId,
      kind: notificationKindFor(txn),
      title,
      amount: txn.appliedAmount,
      transactionId: txn.id,
      refType: txn.refType,
      refId: txn.refId,
    })
    .returning();
  return row;
}

/** Thông báo "bị từ chối" kèm tên mục và lý do (khai rule, báo xong nhiệm vụ, đổi thưởng). */
export async function notifyRejected(
  tx: DbOrTx,
  input: { childId: number; title: string; reason?: string | null; refType: string; refId: number },
): Promise<Notification> {
  const [row] = await tx
    .insert(notifications)
    .values({
      childId: input.childId,
      kind: "rejected",
      title: input.title,
      reason: input.reason?.trim() || null,
      refType: input.refType,
      refId: input.refId,
    })
    .returning();
  return row;
}

/** Thông báo kèm mức gốc của giao dịch và tên bố/mẹ đã thực hiện (màn báo bị trừ cần cả hai). */
export type NotificationView = Notification & { requestedAmount: number | null; actorName: string | null };

const withRequested = {
  n: notifications,
  requestedAmount: transactions.requestedAmount,
  actorName: parents.displayName,
};

function retentionCutoff(clock: Clock): Date {
  return new Date(clock.now().getTime() - NOTIFICATION_RETENTION_DAYS * DAY);
}

/**
 * Số chưa đọc và danh sách thông báo chưa đọc (cũ nhất trước, để màn nhận quà hiện theo thứ tự).
 * Chỉ tính thông báo trong 30 ngày, để số chưa đọc khớp với danh sách trong chuông (spec "Số chưa đọc khớp danh sách").
 */
export async function getUnreadSummary(db: DbOrTx, childId: number, clock: Clock = systemClock): Promise<{ count: number; items: NotificationView[] }> {
  const rows = await db
    .select(withRequested)
    .from(notifications)
    .leftJoin(transactions, eq(transactions.id, notifications.transactionId))
    .leftJoin(parents, eq(parents.id, transactions.actorParentId))
    .where(and(eq(notifications.childId, childId), isNull(notifications.readAt), gte(notifications.createdAt, retentionCutoff(clock))))
    .orderBy(asc(notifications.id));
  const items = rows.map((r) => ({ ...r.n, requestedAmount: r.requestedAmount, actorName: r.actorName }));
  return { count: items.length, items };
}

/** Thông báo trong 30 ngày gần nhất của chính con đó, mới nhất trước. */
export async function listNotifications(db: DbOrTx, childId: number, clock: Clock = systemClock): Promise<NotificationView[]> {
  const since = retentionCutoff(clock);
  const rows = await db
    .select(withRequested)
    .from(notifications)
    .leftJoin(transactions, eq(transactions.id, notifications.transactionId))
    .leftJoin(parents, eq(parents.id, transactions.actorParentId))
    .where(and(eq(notifications.childId, childId), gte(notifications.createdAt, since)))
    .orderBy(desc(notifications.id))
    .limit(200);
  return rows.map((r) => ({ ...r.n, requestedAmount: r.requestedAmount, actorName: r.actorName }));
}

/** Đánh dấu đã đọc; chỉ tác động lên thông báo của chính con đó. Trả về số dòng đã đánh dấu. */
export async function markRead(db: DbOrTx, childId: number, ids: number[], clock: Clock = systemClock): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(notifications)
    .set({ readAt: clock.now() })
    .where(and(eq(notifications.childId, childId), inArray(notifications.id, ids), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

/** Dọn mọi thông báo quá 30 ngày, kể cả chưa đọc (design D3; chạy lúc khởi động và định kỳ). Không đụng tới sổ cái. */
export async function cleanupNotifications(db: DbOrTx, clock: Clock = systemClock): Promise<number> {
  const rows = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, retentionCutoff(clock)))
    .returning({ id: notifications.id });
  return rows.length;
}
