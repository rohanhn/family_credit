import { cleanupAuthAttempts } from "./auth/rate-limit";
import { cleanupExpiredSessions } from "./auth/sessions";
import { systemClock, type Clock } from "./clock";
import type { Db } from "./db/types";
import { cleanupNotifications } from "./domain/notifications";

/** Chu kỳ chạy lại việc dọn dẹp khi server chạy lâu (design D9). */
export const MAINTENANCE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Việc dọn dẹp chạy khi server khởi động và mỗi 24 giờ (design D3 "Thông báo", D9). */
export async function runStartupMaintenance(db: Db, clock: Clock = systemClock) {
  const notifications = await cleanupNotifications(db, clock);
  const authAttempts = await cleanupAuthAttempts(db, clock);
  const sessions = await cleanupExpiredSessions(db, clock);
  return { notifications, authAttempts, sessions };
}
