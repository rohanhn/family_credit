import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { debtOf, encouragementFor, ENCOURAGEMENTS, isInDebt, tasksToThaw, thawProgress } from "@/lib/debt";
import { applyLedgerEntry, getDebtInfo } from "@/server/domain/ledger";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

describe("spec debt-freeze: Trạng thái nợ", () => {
  it("Số dư âm là nợ, số dư 0 không phải nợ", () => {
    expect(isInDebt(-15)).toBe(true);
    expect(debtOf(-15)).toBe(15);
    expect(isInDebt(0)).toBe(false);
    expect(debtOf(0)).toBe(0);
    expect(isInDebt(5)).toBe(false);
    expect(debtOf(5)).toBe(0);
  });
});

describe("spec debt-freeze: Thanh tan băng", () => {
  it("Đã trả được một phần nợ: mốc 20, nợ 15 → 25%, còn 15", () => {
    expect(thawProgress(-15, 20)).toEqual({ percent: 25, remaining: 15 });
  });
  it("Nợ sâu thêm: mốc 25, nợ 25 → 0%, còn 25", () => {
    expect(thawProgress(-25, 25)).toEqual({ percent: 0, remaining: 25 });
  });
  it("Vừa vào trạng thái nợ: 0%, còn 15", () => {
    expect(thawProgress(-15, 15)).toEqual({ percent: 0, remaining: 15 });
  });
});

describe("spec debt-freeze: Động viên", () => {
  it("Nhiệm vụ hôm nay đủ trả nợ: nợ 15, hai nhiệm vụ 10 → 2", () => {
    expect(tasksToThaw(15, [10, 10])).toBe(2);
    expect(encouragementFor("2026-11-19", 2)).toBe("Làm 2 nhiệm vụ hôm nay là tan băng rồi!");
  });
  it("Lấy nhiệm vụ nhiều điểm trước", () => {
    expect(tasksToThaw(15, [5, 20, 5])).toBe(1);
  });
  it("Không đủ trả nợ: nợ 50, một nhiệm vụ 10 → lời chung", () => {
    expect(tasksToThaw(50, [10])).toBeNull();
    expect(ENCOURAGEMENTS).toContain(encouragementFor("2026-11-19", null));
  });
  it("Không còn nhiệm vụ: lời chung, giữ nguyên trong ngày", () => {
    expect(tasksToThaw(10, [])).toBeNull();
    expect(encouragementFor("2026-11-19", null)).toBe(encouragementFor("2026-11-19", null));
  });
});

describe("getDebtInfo", () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  async function setup() {
    const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin"] });
    const child = kids[0];
    const give = (amount: number) =>
      applyLedgerEntry(t.db, { familyId: family.id, childId: child.id, kind: "adhoc", amount, description: "x", actorParentId: parent.id });
    return { child, give };
  }

  it("Không nợ: mốc 0", async () => {
    const { child, give } = await setup();
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: 0, peakDebt: 0 });
    await give(5);
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: 5, peakDebt: 0 });
  });

  it("Giao dịch đầu tiên là phạt: xét toàn bộ lịch sử", async () => {
    const { child, give } = await setup();
    await give(-20);
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: -20, peakDebt: 20 });
  });

  it("Nợ rồi trả một phần: mốc giữ ở số nợ lớn nhất", async () => {
    const { child, give } = await setup();
    await give(-20);
    await give(5);
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: -15, peakDebt: 20 });
    await give(-10);
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: -25, peakDebt: 25 });
  });

  it("Nợ, hết nợ, rồi nợ lại: mốc chỉ tính từ lần ≥ 0 gần nhất", async () => {
    const { child, give } = await setup();
    await give(5);
    await give(-30);
    await give(30);
    await give(-10);
    await give(2);
    expect(await getDebtInfo(t.db, child.id)).toEqual({ balance: -3, peakDebt: 5 });
  });
});
