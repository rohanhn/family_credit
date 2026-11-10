// Nhóm thông báo chưa đọc thành các màn "thông báo điểm mới" của con (design D6, spec ui-theme
// "Thứ tự hiển thị phản hồi điểm", spec kid-notifications "Hiển thị thông báo mới").
// Thuần TypeScript, dùng được ở cả server lẫn client.

export type NotificationItem = {
  id: number;
  kind: "gift" | "penalty" | "rejected";
  title: string;
  /** Mức thực áp dụng (âm khi trừ; đổi thưởng được duyệt là âm nhưng vẫn là "nhận quà"). */
  amount: number | null;
  /** Mức gốc của giao dịch (phạt vượt số dư: mức gốc lớn hơn mức thực trừ). */
  requestedAmount: number | null;
  reason: string | null;
  actorName: string | null;
  refType: string | null;
  /** ISO 8601. */
  createdAt: string;
  /** Đã đọc (chỉ có ý nghĩa ở danh sách của chuông). */
  read?: boolean;
};

export type GiftScreen = {
  kind: "gift";
  items: NotificationItem[];
  /** Tổng điểm được cộng (không tính quà đổi bằng điểm). */
  total: number;
  /** Có ít nhất một yêu cầu đổi thưởng được duyệt. */
  hasRedeem: boolean;
};

export type PenaltyScreen = {
  kind: "penalty";
  items: NotificationItem[];
  /** Tổng mức gốc bị trừ, số dương (hiện "−N" kể cả khi mức thực trừ là 0). */
  total: number;
  /** Tổng mức thực trừ, số dương. */
  applied: number;
};

export type RejectedScreen = { kind: "rejected"; items: NotificationItem[] };

export type FeedbackScreen = GiftScreen | PenaltyScreen | RejectedScreen;

export const isRedeem = (n: NotificationItem) => n.refType === "redemption";

/** Thứ tự: cộng trước, trừ sau, từ chối cuối cùng; trong mỗi màn giữ thứ tự cũ nhất trước. Màn rỗng bị bỏ. */
export function buildScreens(items: NotificationItem[]): FeedbackScreen[] {
  const sorted = [...items].sort((a, b) => a.id - b.id);
  const gifts = sorted.filter((n) => n.kind === "gift");
  const penalties = sorted.filter((n) => n.kind === "penalty");
  const rejected = sorted.filter((n) => n.kind === "rejected");
  const screens: FeedbackScreen[] = [];
  if (gifts.length > 0) {
    screens.push({
      kind: "gift",
      items: gifts,
      total: gifts.filter((n) => !isRedeem(n)).reduce((sum, n) => sum + Math.max(0, n.amount ?? 0), 0),
      hasRedeem: gifts.some(isRedeem),
    });
  }
  if (penalties.length > 0) {
    screens.push({
      kind: "penalty",
      items: penalties,
      total: penalties.reduce((sum, n) => sum + Math.abs(n.requestedAmount ?? n.amount ?? 0), 0),
      applied: penalties.reduce((sum, n) => sum + Math.abs(n.amount ?? 0), 0),
    });
  }
  if (rejected.length > 0) screens.push({ kind: "rejected", items: rejected });
  return screens;
}

/** Khóa ổn định của một màn (loại + id các thông báo): cùng khóa thì là cùng một màn, không phát âm lại. */
export function screenKey(screen: FeedbackScreen): string {
  return `${screen.kind}:${screen.items.map((i) => i.id).join(",")}`;
}

/**
 * Hàng đợi màn phản hồi (design D4): màn đang hiện giữ nguyên cho tới khi con đóng, dù lượt hỏi định kỳ
 * trả về thông báo mới. Chưa có màn nào đang hiện thì lấy màn đầu tiên của các thông báo chưa đọc.
 */
export function keepCurrentScreen(current: FeedbackScreen | null, items: NotificationItem[]): FeedbackScreen | null {
  return current ?? buildScreens(items)[0] ?? null;
}

/** Sau khi con đóng màn `closed`: màn tiếp theo dựng từ các thông báo còn lại (bỏ các thông báo của màn vừa đóng). */
export function nextScreenAfterClose(closed: FeedbackScreen, items: NotificationItem[]): { items: NotificationItem[]; current: FeedbackScreen | null } {
  const ids = new Set(closed.items.map((i) => i.id));
  const remaining = items.filter((i) => !ids.has(i.id));
  return { items: remaining, current: buildScreens(remaining)[0] ?? null };
}

/** "+15", "−10" (dấu trừ thật), "0". */
export function formatPoints(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}
