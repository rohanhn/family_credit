import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrency, normalizeCurrencyName, updateCurrency } from "@/server/domain/currency";
import { applyLedgerEntry, getBalance, listTransactions } from "@/server/domain/ledger";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

describe("spec currency-ledger: Đơn vị tiền tệ của gia đình", () => {
  it("Đơn vị mặc định là Sao với icon ngôi sao", async () => {
    const { family } = await seedFamily(t.db);
    expect(await getCurrency(t.db, family.id)).toEqual({ name: "Sao", icon: "star" });
  });

  it("Đổi tên đơn vị: số điểm và lịch sử cũ không đổi", async () => {
    const { family, parent, kids } = await seedFamily(t.db);
    await applyLedgerEntry(t.db, { familyId: family.id, childId: kids[0].id, kind: "adhoc", amount: 15, description: "Thưởng", actorParentId: parent.id });
    await updateCurrency(t.db, family.id, { name: "Phút game", icon: "game" });
    expect(await getCurrency(t.db, family.id)).toEqual({ name: "Phút game", icon: "game" });
    expect(await getBalance(t.db, kids[0].id)).toBe(15);
    expect((await listTransactions(t.db, { familyId: family.id }))[0].appliedAmount).toBe(15);
  });

  it("Tên phải dài 1–20 ký tự (tính theo ký tự, kể cả tiếng Việt có dấu)", () => {
    expect(() => normalizeCurrencyName("   ")).toThrow(/1 đến 20/);
    expect(() => normalizeCurrencyName("x".repeat(21))).toThrow(/1 đến 20/);
    expect(normalizeCurrencyName("  Phút   game ")).toBe("Phút game");
    expect(normalizeCurrencyName("Điểm thưởng siêu cấp")).toHaveLength(20);
  });

  it("Icon phải thuộc bộ có sẵn", async () => {
    const { family } = await seedFamily(t.db);
    await expect(updateCurrency(t.db, family.id, { name: "Sao", icon: "rocket" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
