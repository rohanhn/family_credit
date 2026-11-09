import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedClock, HOUR } from "@/server/clock";
import { children } from "@/server/db/schema";
import { authenticateChild, authenticateDevice, authenticateParent } from "@/server/auth/guards";
import { createSession } from "@/server/auth/sessions";
import { applyLedgerEntry, getBalance, listTransactions, recordAdjustment } from "@/server/domain/ledger";
import { getUnreadSummary } from "@/server/domain/notifications";
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

async function twoFamilies() {
  const a = await seedFamily(t.db, { kids: ["Bin", "Na"], familyName: "Nhà A" });
  const b = await seedFamily(t.db, { kids: ["Tí"], familyName: "Nhà B" });
  return { a, b };
}

describe("Phân quyền bố mẹ và con", () => {
  it("Guard bố mẹ trả về familyId từ phiên", async () => {
    const { a } = await twoFamilies();
    const { token } = await createSession(t.db, "parent", a.parent.id, clock);
    expect(await authenticateParent(t.db, token, clock)).toMatchObject({ parentId: a.parent.id, familyId: a.family.id, displayName: "Bố" });
  });

  it("Truy cập dữ liệu gia đình khác: trả về như không tồn tại", async () => {
    const { a, b } = await twoFamilies();
    const txn = await applyLedgerEntry(t.db, { familyId: a.family.id, childId: a.kids[0].id, kind: "adhoc", amount: 10, description: "x", actorParentId: a.parent.id });
    // Bố mẹ nhà B dùng familyId của chính mình (từ guard) với id của nhà A.
    await expect(
      applyLedgerEntry(t.db, { familyId: b.family.id, childId: a.kids[0].id, kind: "adhoc", amount: 5, description: "x", actorParentId: b.parent.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(recordAdjustment(t.db, { familyId: b.family.id, originalTransactionId: txn.id, reason: "x", actorParentId: b.parent.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listTransactions(t.db, { familyId: b.family.id, childId: a.kids[0].id })).toEqual([]);
  });

  it("Con cố thực hiện thao tác của bố mẹ: phiên con không qua được guard bố mẹ", async () => {
    const { a } = await twoFamilies();
    const device = await createSession(t.db, "device", a.family.id, clock);
    const child = await createSession(t.db, "child", a.kids[0].id, clock);
    expect(await authenticateChild(t.db, device.token, child.token, clock)).toMatchObject({ childId: a.kids[0].id, familyId: a.family.id });
    expect(await authenticateParent(t.db, child.token, clock)).toBeNull();
    expect(await authenticateParent(t.db, device.token, clock)).toBeNull();
  });

  it("Con xem dữ liệu của anh chị em: guard chỉ cho ra childId của chính con", async () => {
    const { a } = await twoFamilies();
    await applyLedgerEntry(t.db, { familyId: a.family.id, childId: a.kids[1].id, kind: "adhoc", amount: 9, description: "Của Na", actorParentId: a.parent.id });
    const device = await createSession(t.db, "device", a.family.id, clock);
    const bin = await createSession(t.db, "child", a.kids[0].id, clock);
    const auth = await authenticateChild(t.db, device.token, bin.token, clock);
    expect(await getBalance(t.db, auth!.childId)).toBe(0);
    expect((await getUnreadSummary(t.db, auth!.childId)).count).toBe(0);
  });

  it("Phiên con cần thiết bị của cùng gia đình", async () => {
    const { a, b } = await twoFamilies();
    const deviceB = await createSession(t.db, "device", b.family.id, clock);
    const childA = await createSession(t.db, "child", a.kids[0].id, clock);
    expect(await authenticateChild(t.db, deviceB.token, childA.token, clock)).toBeNull();
    expect(await authenticateChild(t.db, undefined, childA.token, clock)).toBeNull();
    expect(await authenticateDevice(t.db, deviceB.token, clock)).toMatchObject({ familyId: b.family.id });
  });

  it("Con đã lưu trữ không còn phiên hợp lệ; phiên con hết hạn sau 2 giờ không dùng", async () => {
    const { a } = await twoFamilies();
    const device = await createSession(t.db, "device", a.family.id, clock);
    const bin = await createSession(t.db, "child", a.kids[0].id, clock);
    const na = await createSession(t.db, "child", a.kids[1].id, clock);
    await t.db.update(children).set({ archivedAt: clock.now() }).where(eq(children.id, a.kids[0].id));
    expect(await authenticateChild(t.db, device.token, bin.token, clock)).toBeNull();
    clock.advance(2 * HOUR + 1);
    expect(await authenticateChild(t.db, device.token, na.token, clock)).toBeNull();
  });
});
