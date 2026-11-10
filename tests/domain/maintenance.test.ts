import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY, fixedClock, HOUR } from "@/server/clock";
import { sessions } from "@/server/db/schema";
import { cleanupExpiredSessions, createSession } from "@/server/auth/sessions";
import { runStartupMaintenance } from "@/server/maintenance";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

// Task 6.1 (design D9): job dọn dẹp xóa phiên hết hạn.

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

describe("Dọn phiên hết hạn", () => {
  it("Phiên hết hạn bị xóa, phiên còn hạn giữ nguyên", async () => {
    const { parent, kids } = await seedFamily(t.db);
    const clock = fixedClock("2026-11-09T03:00:00Z");
    await createSession(t.db, "parent", parent.id, clock, { ttlMs: 1 * HOUR });
    await createSession(t.db, "child", kids[0].id, clock, { ttlMs: 2 * HOUR });
    const kept = await createSession(t.db, "parent", parent.id, clock, { ttlMs: 30 * DAY });

    clock.advance(3 * HOUR);
    expect(await cleanupExpiredSessions(t.db, clock)).toBe(2);
    const left = await t.db.select().from(sessions);
    expect(left.map((s) => s.expiresAt.getTime())).toEqual([kept.expiresAt.getTime()]);
  });

  it("runStartupMaintenance gọi dọn phiên", async () => {
    const { parent } = await seedFamily(t.db);
    const clock = fixedClock("2026-11-09T03:00:00Z");
    await createSession(t.db, "parent", parent.id, clock, { ttlMs: HOUR });
    clock.advance(2 * HOUR);
    expect(await runStartupMaintenance(t.db, clock)).toMatchObject({ sessions: 1 });
    expect(await t.db.select().from(sessions)).toEqual([]);
  });
});
