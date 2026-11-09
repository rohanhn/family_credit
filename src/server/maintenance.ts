import { cleanupAuthAttempts } from "./auth/rate-limit";
import { systemClock, type Clock } from "./clock";
import type { Db } from "./db/types";
import { cleanupNotifications } from "./domain/notifications";

/** Việc dọn dẹp chạy một lần khi server khởi động (design D3 "Thông báo", D9). */
export async function runStartupMaintenance(db: Db, clock: Clock = systemClock) {
  const notifications = await cleanupNotifications(db, clock);
  const authAttempts = await cleanupAuthAttempts(db, clock);
  return { notifications, authAttempts };
}
