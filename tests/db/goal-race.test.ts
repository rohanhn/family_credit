import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import type { Db } from "@/server/db/types";
import { createReward, setGoal, setRewardHidden } from "@/server/domain/shop";
import { seedFamily } from "../helpers/seed";

// Task 4.3 (design D6): chọn mục tiêu song song với ẩn phần thưởng trên Postgres thật.
// Cần DATABASE_URL_TEST; không có thì bỏ qua (xem ledger-race.test.ts).

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("Mục tiêu và ẩn phần thưởng đồng thời", () => {
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

  it("Không bao giờ còn goal_reward_id trỏ tới phần thưởng đang ẩn", async () => {
    const { family, kids } = await seedFamily(db, { familyName: `race-goal-${randomUUID()}`, kids: ["Bin", "Na", "Su"] });
    for (let round = 0; round < 20; round++) {
      const reward = await createReward(db, family.id, { name: `Quà ${round}`, price: 10 });
      await Promise.allSettled([
        ...kids.map((k) => setGoal(db, { familyId: family.id, childId: k.id, rewardId: reward.id })),
        setRewardHidden(db, family.id, reward.id, true),
      ]);
      const rows = await db.select({ goal: schema.children.goalRewardId }).from(schema.children).where(eq(schema.children.familyId, family.id));
      expect(rows.filter((r) => r.goal === reward.id)).toEqual([]);
    }
  });
});
