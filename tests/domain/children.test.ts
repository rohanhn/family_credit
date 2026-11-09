import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixedClock, MINUTE } from "@/server/clock";
import { AVATAR_IDS } from "@/lib/avatars";
import { authenticateChild } from "@/server/auth/guards";
import {
  enableFamilyMode,
  listDevices,
  listKidsForDevice,
  loginChildWithPin,
  logoutChild,
  PIN_WRONG_MESSAGE,
  revokeDevice,
} from "@/server/auth/family-mode";
import { resolveSession } from "@/server/auth/sessions";
import { archiveChild, createChild, listChildren, updateChild } from "@/server/domain/children";
import { applyLedgerEntry, getBalance, listTransactions } from "@/server/domain/ledger";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

let t: TestDb;
const clock = fixedClock("2026-11-09T10:00:00Z");
beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T10:00:00Z");
});
afterEach(async () => {
  await t.close();
});

async function familyWithKid() {
  const { family, parent } = await seedFamily(t.db, { kids: [] });
  const bin = await createChild(t.db, family.id, { name: "Bin", avatar: "boy-brown", pin: "1234" });
  const auth = { parentId: parent.id, familyId: family.id };
  return { family, parent, bin, auth };
}

describe("Quản lý hồ sơ con", () => {
  it("Tạo hồ sơ con: số dư 0, hiện trên màn chọn avatar, PIN được băm", async () => {
    const { family, bin } = await familyWithKid();
    expect(bin.pinHash).toMatch(/^\$argon2id\$/);
    expect(await getBalance(t.db, bin.id)).toBe(0);
    expect((await listKidsForDevice(t.db, family.id, clock)).map((k) => k.name)).toEqual(["Bin"]);
  });

  it("PIN không hợp lệ", async () => {
    const { family } = await seedFamily(t.db, { kids: [] });
    for (const pin of ["123", "12345", "12a4", ""]) {
      await expect(createChild(t.db, family.id, { name: "Na", avatar: "girl-buns", pin })).rejects.toMatchObject({ message: "PIN phải gồm đúng 4 chữ số" });
    }
  });

  it("Avatar phải thuộc bộ có sẵn", async () => {
    const { family } = await seedFamily(t.db, { kids: [] });
    await expect(createChild(t.db, family.id, { name: "Na", avatar: "dragon", pin: "1234" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(AVATAR_IDS.length).toBeGreaterThanOrEqual(6);
  });

  it("Sửa hồ sơ: đổi tên, avatar, PIN", async () => {
    const { family, bin } = await familyWithKid();
    await updateChild(t.db, family.id, bin.id, { name: "Bin Bin", avatar: "boy-ginger", pin: "4321" });
    await expect(loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock)).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "4321" }, clock)).resolves.toBeTruthy();
    expect((await listChildren(t.db, family.id))[0]).toMatchObject({ name: "Bin Bin", avatar: "boy-ginger" });
  });

  it("Lưu trữ hồ sơ con: không đăng nhập được, lịch sử vẫn xem được từ phía bố mẹ", async () => {
    const { family, parent, bin, auth } = await familyWithKid();
    await applyLedgerEntry(t.db, { familyId: family.id, childId: bin.id, kind: "adhoc", amount: 10, description: "Thưởng", actorParentId: parent.id });
    const device = await enableFamilyMode(t.db, auth, clock);
    const session = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    await archiveChild(t.db, family.id, bin.id, clock);
    expect(await authenticateChild(t.db, device.token, session.token, clock)).toBeNull();
    await expect(loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listKidsForDevice(t.db, family.id, clock)).toEqual([]);
    expect(await listTransactions(t.db, { familyId: family.id, childId: bin.id })).toHaveLength(1);
    expect(await listChildren(t.db, family.id, { includeArchived: true })).toHaveLength(1);
  });
});

describe("Đăng nhập con bằng avatar và PIN", () => {
  it("Kích hoạt chế độ gia đình: thiết bị thấy avatar các con mà không cần bố mẹ đăng nhập lại", async () => {
    const { family, auth } = await familyWithKid();
    const device = await enableFamilyMode(t.db, auth, clock);
    expect(await resolveSession(t.db, device.token, "device", clock)).toMatchObject({ subjectId: family.id });
    expect(device.expiresAt.getTime() - clock.now().getTime()).toBe(90 * 24 * 60 * MINUTE);
  });

  it("Con nhập đúng PIN: mở phiên con 2 giờ", async () => {
    const { family, bin, auth } = await familyWithKid();
    const device = await enableFamilyMode(t.db, auth, clock);
    const s = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    expect(s.expiresAt.getTime() - clock.now().getTime()).toBe(120 * MINUTE);
    expect(await authenticateChild(t.db, device.token, s.token, clock)).toMatchObject({ childId: bin.id, name: "Bin" });
  });

  it("Nhập sai PIN quá nhiều lần: khóa 5 phút với thông báo thân thiện, kể cả PIN đúng", async () => {
    const { family, bin } = await familyWithKid();
    const login = (pin: string) => loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin }, clock);
    for (let i = 0; i < 4; i++) await expect(login("0000")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS", message: PIN_WRONG_MESSAGE });
    await expect(login("0000")).rejects.toMatchObject({ code: "LOCKED", message: expect.stringContaining("Đợi 5 phút") });
    await expect(login("1234")).rejects.toMatchObject({ code: "LOCKED" });
    expect((await listKidsForDevice(t.db, family.id, clock))[0].locked).toBe(true);
    clock.advance(5 * MINUTE);
    await expect(login("1234")).resolves.toBeTruthy();
  });

  it("Bộ đếm sai được xóa khi nhập đúng (sai liên tiếp)", async () => {
    const { family, bin } = await familyWithKid();
    const login = (pin: string) => loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin }, clock);
    for (let i = 0; i < 4; i++) await expect(login("0000")).rejects.toThrow();
    await login("1234");
    for (let i = 0; i < 4; i++) await expect(login("0000")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("Không đăng nhập được con của gia đình khác", async () => {
    const { bin } = await familyWithKid();
    const other = await seedFamily(t.db, { familyName: "Nhà khác", kids: [] });
    await expect(loginChildWithPin(t.db, { familyId: other.family.id, childId: bin.id, pin: "1234" }, clock)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Thoát về màn hình chọn avatar: phiên con kết thúc, phiên thiết bị còn", async () => {
    const { family, bin, auth } = await familyWithKid();
    const device = await enableFamilyMode(t.db, auth, clock);
    const s = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    await logoutChild(t.db, s.token);
    expect(await authenticateChild(t.db, device.token, s.token, clock)).toBeNull();
    expect(await resolveSession(t.db, device.token, "device", clock)).not.toBeNull();
  });

  it("Thu hồi thiết bị: thiết bị mất chế độ gia đình và phiên con trên đó", async () => {
    const { family, bin, auth } = await familyWithKid();
    const device = await enableFamilyMode(t.db, auth, clock);
    const s = await loginChildWithPin(t.db, { familyId: family.id, childId: bin.id, pin: "1234" }, clock);
    const [d] = await listDevices(t.db, family.id, clock);
    const other = await seedFamily(t.db, { familyName: "Nhà khác", kids: [] });
    await expect(revokeDevice(t.db, { parentId: other.parent.id, familyId: other.family.id }, d.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await revokeDevice(t.db, auth, d.id);
    expect(await resolveSession(t.db, device.token, "device", clock)).toBeNull();
    expect(await authenticateChild(t.db, device.token, s.token, clock)).toBeNull();
  });
});
