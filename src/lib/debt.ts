// Trạng thái nợ của con (spec debt-freeze, design D2, D9). Thuần TypeScript, dùng được ở cả server lẫn client.
// Trạng thái nợ không được lưu riêng: luôn tính từ số dư hiện tại.

import { progressPercent } from "./progress";

/** Đang nợ khi và chỉ khi số dư < 0; số dư 0 không phải nợ. */
export function isInDebt(balance: number): boolean {
  return balance < 0;
}

/** Số nợ = giá trị tuyệt đối của số dư âm, 0 nếu không nợ. */
export function debtOf(balance: number): number {
  return balance < 0 ? -balance : 0;
}

/**
 * Tiến độ tan băng: phần nợ đã trả so với mốc đầu (số nợ lớn nhất kể từ lần gần nhất số dư ≥ 0).
 * Ví dụ mốc 20, đang nợ 15 → 25%, còn 15.
 */
export function thawProgress(balance: number, peakDebt: number): { percent: number; remaining: number } {
  const remaining = debtOf(balance);
  const peak = Math.max(peakDebt, remaining);
  return { percent: progressPercent(peak - remaining, peak), remaining };
}

/**
 * Số nhiệm vụ ít nhất cần làm để trả hết nợ, lấy nhiệm vụ nhiều điểm trước.
 * `null` nếu tổng điểm các nhiệm vụ còn làm được vẫn không đủ (hoặc không nợ, không còn nhiệm vụ).
 */
export function tasksToThaw(debt: number, openTaskPoints: number[]): number | null {
  if (debt <= 0) return null;
  const sorted = [...openTaskPoints].filter((p) => p > 0).sort((a, b) => b - a);
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i];
    if (sum >= debt) return i + 1;
  }
  return null;
}

/** Lời động viên chung: không trách mắng, không so sánh với ai. */
export const ENCOURAGEMENTS = [
  "Từng bước nhỏ thôi, băng sẽ tan nhanh lắm!",
  "Con làm được mà, cùng kiếm điểm nào!",
  "Mỗi việc tốt là một tia nắng làm tan băng đấy!",
  "Hôm nay là ngày tuyệt vời để bắt đầu lại!",
  "Cố lên nhé, bố mẹ luôn tin con!",
] as const;

/** Chọn lời động viên theo ngày (YYYY-MM-DD theo múi giờ gia đình) để không đổi mỗi lần tải trang. */
export function encouragementFor(date: string, tasksNeeded: number | null): string {
  if (tasksNeeded !== null) {
    return tasksNeeded === 1 ? "Làm 1 nhiệm vụ hôm nay là tan băng rồi!" : `Làm ${tasksNeeded} nhiệm vụ hôm nay là tan băng rồi!`;
  }
  let hash = 0;
  for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ENCOURAGEMENTS[hash % ENCOURAGEMENTS.length];
}
