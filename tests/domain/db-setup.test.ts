import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedClock, MINUTE } from "@/server/clock";
import { children, families, parents, transactions } from "@/server/db/schema";
import { createTestDb, type TestDb } from "../helpers/db";

let t: TestDb;

beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

async function seedTransaction() {
  const [family] = await t.db.insert(families).values({ name: "Nhà test" }).returning();
  const [parent] = await t.db
    .insert(parents)
    .values({ familyId: family.id, email: "bo@example.com", displayName: "Bố", passwordHash: "x" })
    .returning();
  const [child] = await t.db
    .insert(children)
    .values({ familyId: family.id, name: "Bin", avatar: "boy-brown", pinHash: "x" })
    .returning();
  const [txn] = await t.db
    .insert(transactions)
    .values({
      familyId: family.id,
      childId: child.id,
      kind: "adhoc",
      requestedAmount: 10,
      appliedAmount: 10,
      description: "Giúp bà dọn nhà",
      actorParentId: parent.id,
    })
    .returning();
  return txn;
}

describe("helper test PGlite (task 2.3)", () => {
  it("dựng database đã migrate, mỗi test một instance sạch", async () => {
    const rows = await t.db.select().from(families);
    expect(rows).toEqual([]);
    await t.db.insert(families).values({ name: "Nhà A" });
    const [family] = await t.db.select().from(families);
    expect(family.currencyName).toBe("Sao");
    expect(family.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("đồng hồ inject được", () => {
    const clock = fixedClock("2026-11-09T00:00:00Z");
    clock.advance(5 * MINUTE);
    expect(clock.now().toISOString()).toBe("2026-11-09T00:05:00.000Z");
  });
});

describe("sổ cái chỉ ghi thêm (task 2.2)", () => {
  it("chặn UPDATE trực tiếp", async () => {
    const txn = await seedTransaction();
    await expect(t.db.update(transactions).set({ appliedAmount: 99 }).where(eq(transactions.id, txn.id))).rejects.toThrow();
    const [after] = await t.db.select().from(transactions);
    expect(after.appliedAmount).toBe(10);
  });

  it("chặn DELETE trực tiếp", async () => {
    const txn = await seedTransaction();
    await expect(t.db.delete(transactions).where(eq(transactions.id, txn.id))).rejects.toThrow();
    expect(await t.db.select().from(transactions)).toHaveLength(1);
  });

  it("chặn TRUNCATE, kể cả TRUNCATE ... CASCADE vượt qua khóa ngoại", async () => {
    await seedTransaction();
    await expect(t.client.exec("truncate transactions cascade")).rejects.toThrow(/chỉ ghi thêm/);
    expect(await t.db.select().from(transactions)).toHaveLength(1);
  });

  it("CHECK: mức thực trừ không vượt mức gốc", async () => {
    const txn = await seedTransaction();
    await expect(
      t.db.insert(transactions).values({
        familyId: txn.familyId,
        childId: txn.childId,
        kind: "adhoc",
        requestedAmount: -5,
        appliedAmount: -6,
        description: "sai",
        actorParentId: txn.actorParentId,
      }),
    ).rejects.toThrow();
  });
});
