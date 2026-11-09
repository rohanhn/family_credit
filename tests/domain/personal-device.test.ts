import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY, HOUR, fixedClock } from "@/server/clock";
import { authenticateChild, authenticateDevice } from "@/server/auth/guards";
import { createSession } from "@/server/auth/sessions";
import { PERSONAL_CHILD_TTL_MS } from "@/server/auth/session-cookies";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

// Change add-kid-personal-device: máy riêng của con (spec family-accounts "Máy riêng của con",
// "Nhập PIN mỗi lần mở trên máy riêng").

let t: TestDb;
const clock = fixedClock("2026-11-09T10:00:00Z");
beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T10:00:00Z");
});
afterEach(async () => {
  await t.close();
});

describe("Thời hạn phiên theo kiểu thiết bị", () => {
  it("Máy riêng dùng đều đặn hơn 90 ngày vẫn còn hiệu lực; máy dùng chung hết hạn sau 90 ngày", async () => {
    const { family, kids } = await seedFamily(t.db);
    const personal = await createSession(t.db, "device", family.id, clock, { deviceChildId: kids[0].id });
    const shared = await createSession(t.db, "device", family.id, clock);
    for (let day = 0; day < 120; day += 10) {
      clock.advance(10 * DAY);
      expect(await authenticateDevice(t.db, personal.token, clock), `ngày ${day + 10}`).toMatchObject({ childId: kids[0].id });
    }
    expect(await authenticateDevice(t.db, shared.token, clock)).toBeNull();
  });

  it("Máy dùng chung trả childId null", async () => {
    const { family } = await seedFamily(t.db);
    const shared = await createSession(t.db, "device", family.id, clock);
    expect(await authenticateDevice(t.db, shared.token, clock)).toMatchObject({ familyId: family.id, childId: null });
  });

  it("Phiên con trên máy riêng không hết hạn sau 2 giờ và tự gia hạn tới 30 ngày", async () => {
    const { family, kids } = await seedFamily(t.db);
    const device = await createSession(t.db, "device", family.id, clock, { deviceChildId: kids[0].id });
    const child = await createSession(t.db, "child", kids[0].id, clock, { ttlMs: PERSONAL_CHILD_TTL_MS });
    clock.advance(3 * HOUR);
    expect(await authenticateChild(t.db, device.token, child.token, clock)).toMatchObject({ childId: kids[0].id });
    clock.advance(20 * DAY);
    expect(await authenticateChild(t.db, device.token, child.token, clock)).not.toBeNull();
    clock.advance(31 * DAY);
    expect(await authenticateChild(t.db, device.token, child.token, clock)).toBeNull();
  });

  it("Phiên con trên máy dùng chung vẫn hết hạn sau 2 giờ không dùng", async () => {
    const { family, kids } = await seedFamily(t.db);
    const device = await createSession(t.db, "device", family.id, clock);
    const child = await createSession(t.db, "child", kids[0].id, clock);
    clock.advance(2 * HOUR + 1000);
    expect(await authenticateChild(t.db, device.token, child.token, clock)).toBeNull();
  });
});
