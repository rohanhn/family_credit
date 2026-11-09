import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

// Helper test (task 2.3): mỗi lần gọi tạo một PGlite sạch đã chạy cùng migration SQL như production.
// Migration chỉ chạy một lần mỗi file test; các instance sau nạp lại từ bản chụp data dir cho nhanh.

export const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, "../../drizzle");

export type TestDb = { db: Db; client: PGlite; close: () => Promise<void> };

let snapshot: Promise<Blob | File> | undefined;

async function migratedSnapshot(): Promise<Blob | File> {
  const client = new PGlite();
  await migrate(drizzle(client, { schema }), { migrationsFolder: MIGRATIONS_FOLDER });
  const dump = await client.dumpDataDir("none");
  await client.close();
  return dump;
}

export async function createTestDb(): Promise<TestDb> {
  snapshot ??= migratedSnapshot();
  const client = new PGlite({ loadDataDir: await snapshot });
  const db = drizzle(client, { schema });
  return { db: db as unknown as Db, client, close: () => client.close() };
}
