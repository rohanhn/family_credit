"use server";

import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getBalance } from "@/server/domain/ledger";
import { getUnreadSummary, listNotifications, markRead, type NotificationView } from "@/server/domain/notifications";
import type { NotificationItem } from "@/lib/notification-screens";

// Thông báo của con (spec kid-notifications). childId luôn lấy từ phiên của con.

function toItem(n: NotificationView): NotificationItem {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    amount: n.amount,
    requestedAmount: n.requestedAmount,
    reason: n.reason,
    actorName: n.actorName,
    refType: n.refType,
    createdAt: n.createdAt.toISOString(),
    read: n.readAt !== null,
  };
}

export type UnreadPayload = { count: number; items: NotificationItem[]; balance: number };

/** Số chưa đọc, thông báo chưa đọc (cũ nhất trước) và số dư hiện tại; màn con hỏi lại mỗi 30 giây. */
export async function kidUnreadAction(): Promise<UnreadPayload> {
  const kid = await requireChild();
  const db = getDb();
  const [summary, balance] = await Promise.all([getUnreadSummary(db, kid.childId), getBalance(db, kid.childId)]);
  return { count: summary.count, items: summary.items.map(toItem), balance };
}

/** Đánh dấu đã đọc các thông báo của một màn; chỉ tác động lên thông báo của chính con đó. */
export async function kidMarkReadAction(ids: number[]): Promise<{ marked: number }> {
  const kid = await requireChild();
  const clean = Array.isArray(ids) ? ids.filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 200) : [];
  return { marked: await markRead(getDb(), kid.childId, clean) };
}

/** Danh sách 30 ngày gần nhất cho chuông, mới nhất trước. */
export async function kidNotificationListAction(): Promise<NotificationItem[]> {
  const kid = await requireChild();
  return (await listNotifications(getDb(), kid.childId)).map(toItem);
}
