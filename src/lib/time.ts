// Ngày và giờ theo múi giờ của gia đình (design D5). Lưu thời điểm theo UTC; "ngày" là chuỗi YYYY-MM-DD.

const ymd = (tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

/** Ngày (YYYY-MM-DD) của một thời điểm theo múi giờ cho trước. */
export function dateInZone(instant: Date, tz: string): string {
  return ymd(tz).format(instant);
}

/** Chênh lệch (ms) giữa giờ địa phương của múi giờ và UTC tại một thời điểm. */
function zoneOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Thời điểm 00:00 của ngày `date` theo múi giờ `tz`. */
export function startOfDayInZone(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  let instant = guess - zoneOffsetMs(new Date(guess), tz);
  // Chỉnh lại một lần cho múi giờ có giờ mùa hè.
  instant = guess - zoneOffsetMs(new Date(instant), tz);
  return new Date(instant);
}

/** Cộng số ngày vào chuỗi YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Thứ trong tuần của chuỗi ngày: 0 = thứ Hai ... 6 = Chủ nhật. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function formatDateTime(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(instant);
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** "+5" / "−5" (dấu trừ Unicode cho dễ đọc). */
export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
