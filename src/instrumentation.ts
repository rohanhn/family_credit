// Chạy một lần khi server Next.js khởi động.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { logger } = await import("./server/log");
  try {
    const [{ getDb }, { runStartupMaintenance }] = await Promise.all([import("./server/db/client"), import("./server/maintenance")]);
    const result = await runStartupMaintenance(getDb());
    logger.info({ event: "startup_maintenance", ...result }, "startup_maintenance");
  } catch (err) {
    // Dọn dẹp thất bại không được chặn server khởi động.
    logger.error({ event: "startup_maintenance_failed", err }, "startup_maintenance_failed");
  }
}
