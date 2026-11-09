import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY, HOUR, fixedClock } from "@/server/clock";
import { authenticateChild, authenticateDevice } from "@/server/auth/guards";
import { createSession, resolveSession } from "@/server/auth/sessions";
import { enablePersonalDevice, listKidsForDevice, loginChildWithPin } from "@/server/auth/family-mode";
import { children } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { archiveChild, createChild } from "@/server/domain/children";
import { setSecurityLogSink } from "@/server/log";
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

describe("Bật máy riêng", () => {
  it("Cấp phiên device gắn với con, kết thúc phiên bố mẹ và phiên thiết bị cũ của máy", async () => {
    const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
    const auth = { parentId: parent.id, familyId: family.id };
    const parentSession = await createSession(t.db, "parent", parent.id, clock);
    const oldDevice = await createSession(t.db, "device", family.id, clock);
    const events: [string, unknown][] = [];
    setSecurityLogSink((e, f) => events.push([e, f]));
    const device = await enablePersonalDevice(t.db, auth, kids[0].id, clock, { parentToken: parentSession.token, currentDeviceToken: oldDevice.token });
    setSecurityLogSink();
    expect(await authenticateDevice(t.db, device.token, clock)).toMatchObject({ familyId: family.id, childId: kids[0].id });
    expect(await resolveSession(t.db, parentSession.token, "parent", clock)).toBeNull();
    expect(await authenticateDevice(t.db, oldDevice.token, clock)).toBeNull();
    expect(events).toContainEqual(["device_enabled", expect.objectContaining({ detail: "personal", childId: kids[0].id })]);
  });

  it("Từ chối con đã lưu trữ hoặc thuộc gia đình khác", async () => {
    const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
    const auth = { parentId: parent.id, familyId: family.id };
    await archiveChild(t.db, family.id, kids[1].id, clock);
    await expect(enablePersonalDevice(t.db, auth, kids[1].id, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await seedFamily(t.db, { familyName: "Nhà khác", kids: ["Tí"] });
    await expect(enablePersonalDevice(t.db, auth, other.kids[0].id, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Đăng nhập trên máy riêng", () => {
  async function setupPersonal() {
    const { family, parent } = await seedFamily(t.db, { kids: [] });
    const bin = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: "1234" });
    const na = await createChild(t.db, family.id, { name: "Na", avatar: "girl-brown", pin: "5678" });
    const device = await enablePersonalDevice(t.db, { parentId: parent.id, familyId: family.id }, bin.id, clock);
    const deviceAuth = (await authenticateDevice(t.db, device.token, clock))!;
    return { family, bin, na, device, deviceAuth };
  }

  it("Bật máy riêng: màn đăng nhập chỉ hiện con sở hữu máy; Bin đăng nhập được, phiên kiểu phiên trình duyệt", async () => {
    const { family, bin, device, deviceAuth } = await setupPersonal();
    expect((await listKidsForDevice(t.db, deviceAuth, clock)).map((k) => k.name)).toEqual(["Bin"]);
    const s = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234", deviceChildId: deviceAuth.childId }, clock);
    expect(s.browserSession).toBe(true);
    expect(s.expiresAt.getTime() - clock.now().getTime()).toBe(PERSONAL_CHILD_TTL_MS);
    expect(await authenticateChild(t.db, device.token, s.token, clock)).toMatchObject({ childId: bin.id });
  });

  it("Con khác không đăng nhập được trên máy riêng, kể cả PIN đúng, và không bị tăng bộ đếm sai PIN", async () => {
    const { family, na, deviceAuth } = await setupPersonal();
    for (let i = 0; i < 6; i++) {
      await expect(loginChildWithPin(t.db, { familyId: family.id, childId: na.id, pin: "5678", deviceChildId: deviceAuth.childId }, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    const [row] = await t.db.select().from(children).where(eq(children.id, na.id));
    expect(row.failedPinCount).toBe(0);
    expect(row.lockedUntil).toBeNull();
  });

  it("Phiên của con khác không dùng được cùng cookie máy riêng", async () => {
    const { family, na, device } = await setupPersonal();
    const shared = await createSession(t.db, "device", family.id, clock);
    const naSession = await loginChildWithPin(t.db, { familyId: family.id, childId: na.id, pin: "5678", deviceChildId: null }, clock);
    expect(naSession.browserSession).toBe(false);
    expect(await authenticateChild(t.db, shared.token, naSession.token, clock)).not.toBeNull();
    expect(await authenticateChild(t.db, device.token, naSession.token, clock)).toBeNull();
  });
});
