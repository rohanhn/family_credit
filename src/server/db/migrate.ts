import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Chạy migration Drizzle trong pg_advisory_lock để hai container không chạy cùng lúc (design D2).
// Dùng một kết nối duy nhất (max: 1) vì advisory lock gắn với session.

/** Khóa cố định của app; chọn ngẫu nhiên một lần, không đổi. */
export const MIGRATION_LOCK_KEY = 728_431_905;

export async function runMigrations(url: string, migrationsFolder = path.resolve(process.cwd(), "drizzle")): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(sql), { migrationsFolder });
    } finally {
      await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
  } finally {
    await sql.end();
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Thiếu biến môi trường DATABASE_URL");
    process.exit(1);
  }
  try {
    await runMigrations(url);
    console.log("Migration xong");
  } catch (err) {
    console.error("Migration thất bại:", err);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  void main();
}
