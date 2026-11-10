// Chạy một lần khi server Next.js khởi động: dọn dẹp ngay, rồi lặp lại mỗi 24 giờ (design D9).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { logger } = await import("./server/log");
  const [{ getDb }, { runStartupMaintenance, MAINTENANCE_INTERVAL_MS }] = await Promise.all([import("./server/db/client"), import("./server/maintenance")]);
  const run = async (event: "startup_maintenance" | "periodic_maintenance") => {
    try {
      const result = await runStartupMaintenance(getDb());
      logger.info({ event, ...result }, event);
    } catch (err) {
      // Dọn dẹp thất bại không được chặn server khởi động hay làm server dừng.
      logger.error({ event: `${event}_failed`, err }, `${event}_failed`);
    }
  };
  await run("startup_maintenance");
  // unref: bộ hẹn giờ không giữ tiến trình sống khi server tắt.
  setInterval(() => void run("periodic_maintenance"), MAINTENANCE_INTERVAL_MS).unref();
}
