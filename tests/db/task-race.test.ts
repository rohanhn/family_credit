import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DAY, fixedClock } from "@/server/clock";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import type { Db } from "@/server/db/types";
import { createTask, reportDone } from "@/server/domain/daily-tasks";
import { seedFamily } from "../helpers/seed";

// Task 5.1 (design D8): hai con báo xong cùng một nhiệm vụ nhóm đồng thời trên Postgres thật.
// Cần DATABASE_URL_TEST; không có thì bỏ qua (xem ledger-race.test.ts).

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("Báo xong nhiệm vụ nhóm đồng thời", () => {
  let sql: postgres.Sql;
  let db: Db;

  beforeAll(async () => {
    await runMigrations(url!);
    sql = postgres(url!, { max: 10, onnotice: () => {} });
    db = drizzle(sql, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("Cả hai đều thành công, chỉ một dòng pending, tên người báo là con đến trước", async () => {
    const { family, kids } = await seedFamily(db, { familyName: `race-task-${randomUUID()}`, kids: ["Bin", "Na"] });
    await db.update(schema.children).set({ createdAt: new Date("2026-01-01T00:00:00Z") }).where(eq(schema.children.familyId, family.id));
    const clock = fixedClock("2026-11-09T03:00:00Z");
    for (let round = 0; round < 10; round++) {
      const task = await createTask(
        db,
        family.id,
        { name: `Dọn phòng ${round}`, points: 5, weekdays: [0, 1, 2, 3, 4, 5, 6], mode: "group", assignAll: false, childIds: kids.map((k) => k.id) },
        clock,
      );
      const day = fixedClock(new Date(clock.now().getTime() + DAY));
      const results = await Promise.allSettled(kids.map((k) => reportDone(db, { familyId: family.id, childId: k.id }, task.id, day)));
      expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
      const rows = await db.select().from(schema.taskDays).where(and(eq(schema.taskDays.taskId, task.id)));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("pending");
      // Cả hai lời gọi trả về cùng một người báo, đúng với dòng trong DB.
      for (const r of results) {
        if (r.status === "fulfilled") expect(r.value).toMatchObject({ status: "pending", reportedByChildId: rows[0].reportedByChildId });
      }
    }
  });
});
