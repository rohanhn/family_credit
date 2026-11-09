import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyLedgerEntry, getBalance, listTransactions, recordAdjustment } from "@/server/domain/ledger";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

async function setup() {
  const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
  const give = (childId: number, amount: number, description = "Thưởng", kind: "adhoc" | "rule" | "redeem" = "adhoc") =>
    applyLedgerEntry(t.db, { familyId: family.id, childId, kind, amount, description, actorParentId: parent.id });
  return { family, parent, bin: kids[0], na: kids[1], give };
}

describe("spec currency-ledger", () => {
  it("Ghi giao dịch: có loại, mô tả, người thực hiện và thời điểm", async () => {
    const { bin, give, parent } = await setup();
    const txn = await give(bin.id, 10, "Giúp bà dọn nhà");
    expect(txn).toMatchObject({ requestedAmount: 10, appliedAmount: 10, kind: "adhoc", description: "Giúp bà dọn nhà", actorParentId: parent.id });
    expect(txn.createdAt).toBeInstanceOf(Date);
  });

  it("Số dư sau nhiều giao dịch: +10, +5, -3 = 12", async () => {
    const { bin, give } = await setup();
    await give(bin.id, 10);
    await give(bin.id, 5);
    await give(bin.id, -3);
    expect(await getBalance(t.db, bin.id)).toBe(12);
  });

  it("Phạt vượt số dư: có 5, phạt 20 thì thực trừ -5, gốc -20, số dư 0", async () => {
    const { bin, give } = await setup();
    await give(bin.id, 5);
    const txn = await give(bin.id, -20, "Nói dối");
    expect(txn.requestedAmount).toBe(-20);
    expect(txn.appliedAmount).toBe(-5);
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });

  it("Phạt khi số dư 0: vẫn ghi giao dịch với thực trừ 0, gốc -10", async () => {
    const { bin, give } = await setup();
    const txn = await give(bin.id, -10, "Nói dối");
    expect(txn.requestedAmount).toBe(-10);
    expect(txn.appliedAmount).toBe(0);
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });

  it("Hoàn tác một lần thưởng nhầm bằng giao dịch điều chỉnh", async () => {
    const { family, parent, bin, give } = await setup();
    const wrong = await give(bin.id, 10, "Thưởng nhầm");
    const adj = await recordAdjustment(t.db, { familyId: family.id, originalTransactionId: wrong.id, reason: "bấm nhầm", actorParentId: parent.id });
    expect(adj).toMatchObject({ kind: "adjust", requestedAmount: -10, appliedAmount: -10, refType: "transaction", refId: wrong.id });
    expect(adj.description).toContain("bấm nhầm");
    expect(await getBalance(t.db, bin.id)).toBe(0);
    // Giao dịch gốc vẫn còn trong lịch sử.
    expect(await listTransactions(t.db, { familyId: family.id, childId: bin.id })).toHaveLength(2);
  });

  it("Một giao dịch chỉ điều chỉnh được một lần, không điều chỉnh giao dịch điều chỉnh", async () => {
    const { family, parent, bin, give } = await setup();
    const wrong = await give(bin.id, 10, "Thưởng nhầm");
    await give(bin.id, 20, "Thưởng");
    const adjust = (id: number) => recordAdjustment(t.db, { familyId: family.id, originalTransactionId: id, reason: "bấm nhầm", actorParentId: parent.id });
    const adj = await adjust(wrong.id);
    await expect(adjust(wrong.id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(adjust(adj.id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await getBalance(t.db, bin.id)).toBe(20);
    const rows = await listTransactions(t.db, { familyId: family.id, childId: bin.id });
    expect(rows.find((r) => r.id === wrong.id)?.adjusted).toBe(true);
    expect(rows.filter((r) => r.id !== wrong.id).every((r) => !r.adjusted)).toBe(true);
  });

  it("Điều chỉnh bắt buộc có lý do và không tìm được giao dịch của gia đình khác", async () => {
    const { family, parent, bin, give } = await setup();
    const txn = await give(bin.id, 10);
    await expect(recordAdjustment(t.db, { familyId: family.id, originalTransactionId: txn.id, reason: "  ", actorParentId: parent.id })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    await expect(recordAdjustment(t.db, { familyId: other.family.id, originalTransactionId: txn.id, reason: "x", actorParentId: other.parent.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Bố mẹ xem lịch sử một con: mới nhất trước, có người thực hiện, không lẫn con khác", async () => {
    const { family, bin, na, give } = await setup();
    await give(bin.id, 10, "Một");
    await give(na.id, 7, "Của Na");
    await give(bin.id, 5, "Hai");
    const rows = await listTransactions(t.db, { familyId: family.id, childId: bin.id });
    expect(rows.map((r) => r.description)).toEqual(["Hai", "Một"]);
    expect(rows[0]).toMatchObject({ actorName: "Bố", childName: "Bin" });
    expect(await listTransactions(t.db, { familyId: family.id })).toHaveLength(3);
  });

  it("Lọc theo loại và theo khoảng thời gian", async () => {
    const { family, bin, give } = await setup();
    await give(bin.id, 60, "Thưởng");
    await give(bin.id, -50, "30 phút chơi game", "redeem");
    const redeem = await listTransactions(t.db, { familyId: family.id, kinds: ["redeem"] });
    expect(redeem.map((r) => r.description)).toEqual(["30 phút chơi game"]);
    const future = await listTransactions(t.db, { familyId: family.id, from: new Date(Date.now() + 60_000) });
    expect(future).toEqual([]);
  });

  it("Không ghi được cho con của gia đình khác", async () => {
    const { bin } = await setup();
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    await expect(
      applyLedgerEntry(t.db, { familyId: other.family.id, childId: bin.id, kind: "adhoc", amount: 5, description: "x", actorParentId: other.parent.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
