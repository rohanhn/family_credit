import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixedClock, DAY, HOUR, MINUTE } from "@/server/clock";
import { parents, sessions } from "@/server/db/schema";
import { createSession, resolveSession } from "@/server/auth/sessions";
import { PARENT_ON_FAMILY_DEVICE_TTL_MS } from "@/server/auth/session-cookies";
import { createTestDb, type TestDb } from "../helpers/db";

// Thời hạn riêng của từng phiên (task 1.1, design D1 của change polish-after-mvp).

let t: TestDb;
let parentId: number;
const clock = fixedClock("2026-11-10T10:00:00Z");

beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-10T10:00:00Z");
  const [p] = await t.db.insert(parents).values({ email: "me@example.com", displayName: "Mẹ", passwordHash: "x" }).returning({ id: parents.id });
  parentId = p.id;
});
afterEach(async () => {
  await t.close();
});

const shortSession = () => createSession(t.db, "parent", parentId, clock, { ttlMs: PARENT_ON_FAMILY_DEVICE_TTL_MS, persistTtl: true });

describe("Thời hạn riêng của phiên", () => {
  it("Phiên 15 phút lưu ttl_ms; phiên thường để null", async () => {
    await shortSession();
    await createSession(t.db, "parent", parentId, clock);
    const rows = await t.db.select({ ttlMs: sessions.ttlMs }).from(sessions);
    expect(rows.map((r) => r.ttlMs).sort()).toEqual([15 * MINUTE, null].sort());
  });

  it("ttlMs không kèm persistTtl thì không lưu (phiên con trên máy riêng)", async () => {
    await createSession(t.db, "child", 1, clock, { ttlMs: 30 * DAY });
    const [row] = await t.db.select({ ttlMs: sessions.ttlMs }).from(sessions);
    expect(row.ttlMs).toBeNull();
  });

  it("Phiên 15 phút hết hạn sau 15 phút không dùng", async () => {
    const s = await shortSession();
    expect(s.expiresAt.getTime() - clock.now().getTime()).toBe(15 * MINUTE);
    clock.advance(15 * MINUTE);
    expect(await resolveSession(t.db, s.token, "parent", clock)).toBeNull();
  });

  it("Phiên 15 phút còn dùng thì được gia hạn theo 15 phút, sống qua 40 phút", async () => {
    const s = await shortSession();
    for (let i = 0; i < 8; i++) {
      clock.advance(5 * MINUTE);
      const r = await resolveSession(t.db, s.token, "parent", clock);
      expect(r).not.toBeNull();
      // Gia hạn theo thời hạn riêng, không theo 30 ngày mặc định.
      expect(r!.expiresAt.getTime() - clock.now().getTime()).toBe(15 * MINUTE);
    }
    clock.advance(15 * MINUTE);
    expect(await resolveSession(t.db, s.token, "parent", clock)).toBeNull();
  });

  it("Phiên ttl_ms null vẫn sống 30 ngày và gia hạn theo 30 ngày", async () => {
    const s = await createSession(t.db, "parent", parentId, clock);
    clock.advance(HOUR);
    expect(await resolveSession(t.db, s.token, "parent", clock)).not.toBeNull();
    clock.advance(4 * DAY);
    const r = await resolveSession(t.db, s.token, "parent", clock);
    expect(r!.expiresAt.getTime() - clock.now().getTime()).toBe(30 * DAY);
  });

  it("opts.ttlMs khi resolve vẫn được ưu tiên hơn thời hạn lưu trong phiên", async () => {
    const s = await shortSession();
    clock.advance(5 * MINUTE);
    const r = await resolveSession(t.db, s.token, "parent", clock, { ttlMs: HOUR });
    expect(r!.expiresAt.getTime() - clock.now().getTime()).toBe(HOUR);
  });
});
