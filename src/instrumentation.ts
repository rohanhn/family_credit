// Chạy một lần khi server Next.js khởi động.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  try {
    const [{ getDb }, { runStartupMaintenance }] = await Promise.all([
      import("./server/db/client"),
      import("./server/maintenance"),
    ]);
    const result = await runStartupMaintenance(getDb());
    console.log(JSON.stringify({ event: "startup_maintenance", ...result }));
  } catch (err) {
    // Dọn dẹp thất bại không được chặn server khởi động.
    console.error(JSON.stringify({ event: "startup_maintenance_failed", error: String(err) }));
  }
}
