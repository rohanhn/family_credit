import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { systemClock, type Clock, DAY } from "../clock";
import { notifications, transactions } from "../db/schema";
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

export type NotificationView = Notification & { requestedAmount: number | null };

const withRequested = {
  n: notifications,
  requestedAmount: transactions.requestedAmount,
};

/** Số chưa đọc và danh sách thông báo chưa đọc (cũ nhất trước, để màn nhận quà hiện theo thứ tự). */
export async function getUnreadSummary(db: DbOrTx, childId: number): Promise<{ count: number; items: NotificationView[] }> {
  const rows = await db
    .select(withRequested)
    .from(notifications)
    .leftJoin(transactions, eq(transactions.id, notifications.transactionId))
    .where(and(eq(notifications.childId, childId), isNull(notifications.readAt)))
    .orderBy(asc(notifications.id));
  const items = rows.map((r) => ({ ...r.n, requestedAmount: r.requestedAmount }));
  return { count: items.length, items };
}

/** Thông báo trong 30 ngày gần nhất của chính con đó, mới nhất trước. */
export async function listNotifications(db: DbOrTx, childId: number, clock: Clock = systemClock): Promise<NotificationView[]> {
  const since = new Date(clock.now().getTime() - NOTIFICATION_RETENTION_DAYS * DAY);
  const rows = await db
    .select(withRequested)
    .from(notifications)
    .leftJoin(transactions, eq(transactions.id, notifications.transactionId))
    .where(and(eq(notifications.childId, childId), gte(notifications.createdAt, since)))
    .orderBy(desc(notifications.id))
    .limit(200);
  return rows.map((r) => ({ ...r.n, requestedAmount: r.requestedAmount }));
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

/** Dọn thông báo đã đọc quá 30 ngày (chạy lúc khởi động). Không đụng tới sổ cái. */
export async function cleanupNotifications(db: DbOrTx, clock: Clock = systemClock): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - NOTIFICATION_RETENTION_DAYS * DAY);
  const rows = await db
    .delete(notifications)
    .where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, cutoff)))
    .returning({ id: notifications.id });
  return rows.length;
}

/** Số chưa đọc (dùng cho chuông). */
export async function countUnread(db: DbOrTx, childId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.childId, childId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}
