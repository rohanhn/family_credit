// Phần trăm tiến độ dùng chung cho thanh tiến độ và số phần trăm hiển thị (design D6), để hai chỗ không lệch nhau.

/** Làm tròn xuống và giới hạn trong 0–100; max ≤ 0 thì là 0. Ví dụ 199/200 → 99. */
export function progressPercent(value: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, Math.floor((value * 100) / max)));
}
