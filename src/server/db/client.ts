import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import type { Db } from "./types";

// Kết nối PostgreSQL dùng chung cho cả tiến trình (design D2).
// Tạo lười để `next build` không mở kết nối khi chỉ import module.

let sql: postgres.Sql | undefined;
let db: Db | undefined;

function poolMax(): number {
  const n = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return Number.isInteger(n) && n > 0 ? n : 5;
}

export function getSql(): postgres.Sql {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Thiếu biến môi trường DATABASE_URL");
    sql = postgres(url, { max: poolMax(), onnotice: () => {} });
  }
  return sql;
}

export function getDb(): Db {
  if (!db) db = drizzle(getSql(), { schema }) as unknown as Db;
  return db;
}

export async function closeDb(): Promise<void> {
  await sql?.end();
  sql = undefined;
  db = undefined;
}
