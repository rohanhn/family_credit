import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DAY, HOUR, fixedClock } from "@/server/clock";
import { authenticateChild, authenticateDevice } from "@/server/auth/guards";
import { createSession, resolveSession } from "@/server/auth/sessions";
import { changeChildPin, enableFamilyMode, enablePersonalDevice, listDevices, listKidsForDevice, loginChildWithPin } from "@/server/auth/family-mode";
import { children } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { archiveChild, createChild, updateChild } from "@/server/domain/children";
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

describe("Danh sách và thu hồi máy riêng", () => {
  it("Danh sách thiết bị ghi rõ máy dùng chung hay máy riêng của con nào", async () => {
    const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin"] });
    const auth = { parentId: parent.id, familyId: family.id };
    await enableFamilyMode(t.db, auth, clock);
    clock.advance(1000);
    await enablePersonalDevice(t.db, auth, kids[0].id, clock);
    const devices = await listDevices(t.db, family.id, clock);
    expect(devices.map((d) => [d.kind, d.childName])).toEqual([
      ["shared", null],
      ["personal", "Bin"],
    ]);
  });

  it("Lưu trữ con thu hồi máy riêng của con đó, máy dùng chung vẫn còn", async () => {
    const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
    const auth = { parentId: parent.id, familyId: family.id };
    const shared = await enableFamilyMode(t.db, auth, clock);
    const binPhone = await enablePersonalDevice(t.db, auth, kids[0].id, clock);
    const naPhone = await enablePersonalDevice(t.db, auth, kids[1].id, clock);
    await archiveChild(t.db, family.id, kids[0].id, clock);
    expect(await authenticateDevice(t.db, binPhone.token, clock)).toBeNull();
    expect(await authenticateDevice(t.db, naPhone.token, clock)).not.toBeNull();
    expect(await authenticateDevice(t.db, shared.token, clock)).not.toBeNull();
  });
});

describe("Con đổi PIN", () => {
  async function setupKid() {
    const { family, parent } = await seedFamily(t.db, { kids: [] });
    const bin = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: "1234" });
    const shared = await enableFamilyMode(t.db, { parentId: parent.id, familyId: family.id }, clock);
    const kid = { familyId: family.id, childId: bin.id };
    const login = (pin: string) => loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin }, clock);
    const change = (currentPin: string, newPin: string, confirmPin = newPin) => changeChildPin(t.db, kid, { currentPin, newPin, confirmPin }, clock);
    return { family, parent, bin, shared, kid, login, change };
  }

  it("Đổi PIN thành công: PIN mới dùng được, PIN cũ không, phiên hiện tại vẫn giữ, có log không chứa PIN", async () => {
    const { bin, shared, login, change } = await setupKid();
    const session = await login("1234");
    const events: [string, unknown][] = [];
    setSecurityLogSink((e, f) => events.push([e, f]));
    await change("1234", "4321");
    setSecurityLogSink();
    expect(await authenticateChild(t.db, shared.token, session.token, clock)).toMatchObject({ childId: bin.id });
    await expect(login("1234")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(login("4321")).resolves.toBeTruthy();
    expect(events).toEqual([["pin_changed", { familyId: bin.familyId, childId: bin.id }]]);
    expect(JSON.stringify(events)).not.toContain("4321");
    const [row] = await t.db.select().from(children).where(eq(children.id, bin.id));
    expect(row.pinChangedAt?.toISOString()).toBe(clock.now().toISOString());
  });

  it("Sai PIN hiện tại: từ chối, PIN không đổi, tính vào bộ đếm và khóa sau 5 lần", async () => {
    const { login, change } = await setupKid();
    for (let i = 0; i < 4; i++) await expect(change("0000", "4321")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(change("0000", "4321")).rejects.toMatchObject({ code: "LOCKED" });
    // Đang khóa: cả đổi PIN lẫn đăng nhập đều bị chặn, kể cả PIN đúng.
    await expect(change("1234", "4321")).rejects.toMatchObject({ code: "LOCKED" });
    await expect(login("1234")).rejects.toMatchObject({ code: "LOCKED" });
    clock.advance(5 * 60 * 1000 + 1000);
    await expect(login("1234")).resolves.toBeTruthy();
  });

  it("PIN mới không hợp lệ: sai định dạng, trùng PIN cũ, hai lần nhập khác nhau", async () => {
    const { login, change } = await setupKid();
    await expect(change("1234", "12a4")).rejects.toMatchObject({ code: "INVALID_INPUT", message: "PIN phải gồm đúng 4 chữ số" });
    await expect(change("1234", "4321", "4322")).rejects.toMatchObject({ code: "INVALID_INPUT", message: "Hai lần nhập PIN mới chưa giống nhau" });
    await expect(change("1234", "1234")).rejects.toMatchObject({ code: "INVALID_INPUT", message: "PIN mới phải khác PIN hiện tại" });
    await expect(login("1234")).resolves.toBeTruthy();
  });

  it("Bố mẹ đặt lại PIN khi con quên: ghi pin_changed_at và log pin_reset", async () => {
    const { family, parent, bin, login } = await setupKid();
    const events: [string, unknown][] = [];
    setSecurityLogSink((e, f) => events.push([e, f]));
    await updateChild(t.db, family.id, bin.id, { pin: "9999" }, { parentId: parent.id, clock });
    await updateChild(t.db, family.id, bin.id, { name: "Bin Bin" }, { parentId: parent.id, clock });
    setSecurityLogSink();
    await expect(login("9999")).resolves.toBeTruthy();
    expect(events).toEqual([["pin_reset", { familyId: family.id, childId: bin.id, parentId: parent.id }]]);
    const [row] = await t.db.select().from(children).where(eq(children.id, bin.id));
    expect(row.pinChangedAt?.toISOString()).toBe(clock.now().toISOString());
  });
});

describe("Thay phiên cũ của chính thiết bị (task 6.2, design D9)", () => {
  it("Bật lại chế độ gia đình trên cùng thiết bị: danh sách thiết bị không tăng, phiên cũ hết hiệu lực", async () => {
    const { family, parent } = await seedFamily(t.db);
    const auth = { parentId: parent.id, familyId: family.id };
    const first = await enableFamilyMode(t.db, auth, clock);
    const other = await enableFamilyMode(t.db, auth, clock);
    expect(await listDevices(t.db, family.id, clock)).toHaveLength(2);

    const again = await enableFamilyMode(t.db, auth, clock, { currentDeviceToken: first.token });
    expect(await listDevices(t.db, family.id, clock)).toHaveLength(2);
    expect(await authenticateDevice(t.db, first.token, clock)).toBeNull();
    expect(await authenticateDevice(t.db, again.token, clock)).not.toBeNull();
    expect(await authenticateDevice(t.db, other.token, clock)).not.toBeNull();
  });

  it("Đăng nhập PIN xóa phiên con cũ của thiết bị", async () => {
    const { family } = await seedFamily(t.db, { kids: [] });
    const bin = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: "1234" });
    const na = await createChild(t.db, family.id, { name: "Na", avatar: "girl-black", pin: "5678" });
    const old = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    const next = await loginChildWithPin(t.db, { familyId: family.id, childId: na.id, pin: "5678", previousChildToken: old.token }, clock);
    expect(await resolveSession(t.db, old.token, "child", clock)).toBeNull();
    expect(await resolveSession(t.db, next.token, "child", clock)).not.toBeNull();
  });

  it("PIN sai không xóa phiên con cũ", async () => {
    const { family } = await seedFamily(t.db, { kids: [] });
    const bin = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: "1234" });
    const old = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    await expect(loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "0000", previousChildToken: old.token }, clock)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(await resolveSession(t.db, old.token, "child", clock)).not.toBeNull();
  });
});
