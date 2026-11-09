import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import type { Db } from "@/server/db/types";
import { applyLedgerEntry, getBalance, recordAdjustment } from "@/server/domain/ledger";
import { loginParent, registerParent } from "@/server/auth/parent-auth";
import { seedFamily } from "../helpers/seed";

// Test chống race trên Postgres thật (task 8.2, design D3): PGlite chỉ có một kết nối nên không
// tái hiện được hai transaction đồng thời. Cần DATABASE_URL_TEST trỏ tới một database riêng;
// không có thì bỏ qua. Sổ cái chỉ ghi thêm nên dữ liệu test được để lại, mỗi lần chạy dùng gia đình mới.

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("Chống race trên Postgres thật", () => {
  let sql: postgres.Sql;
  let db: Db;

  beforeAll(async () => {
    await runMigrations(url!);
    sql = postgres(url!, { max: 10, onnotice: () => {} });
    db = drizzle(sql, { schema }) as unknown as Db;
  });

  afterAll(async () => {
    await sql?.end();
  });

  it("Hai giao dịch phạt đồng thời trên cùng một con không làm số dư âm", async () => {
    const { family, parent, kids } = await seedFamily(db, { familyName: `race-${randomUUID()}` });
    const child = kids[0];
    const entry = (amount: number, description: string) =>
      applyLedgerEntry(db, { familyId: family.id, childId: child.id, kind: "adhoc", amount, description, actorParentId: parent.id });

    await entry(10, "Thưởng ban đầu");

    // Mỗi giao dịch chạy trên một kết nối riêng của pool; không có khóa dòng thì cả hai đều
    // đọc số dư 10 và cùng trừ 10, làm số dư thành -10.
    for (let round = 0; round < 5; round++) {
      const results = await Promise.all([entry(-10, `Phạt A${round}`), entry(-10, `Phạt B${round}`)]);
      expect(results.map((r) => r.appliedAmount).sort((a, b) => a - b)).toEqual(round === 0 ? [-10, 0] : [0, 0]);
      expect(await getBalance(db, child.id)).toBe(0);
    }

    await entry(7, "Thưởng lại");
    const many = await Promise.all(Array.from({ length: 8 }, (_, i) => entry(-3, `Phạt song song ${i}`)));
    expect(many.reduce((sum, r) => sum + r.appliedAmount, 0)).toBe(-7);
    expect(await getBalance(db, child.id)).toBe(0);
  });

  it("Hai bố mẹ điều chỉnh đồng thời cùng một giao dịch: chỉ một lần được ghi", async () => {
    const { family, parent, kids } = await seedFamily(db, { familyName: `race-adj-${randomUUID()}` });
    const child = kids[0];
    const original = await applyLedgerEntry(db, { familyId: family.id, childId: child.id, kind: "adhoc", amount: 10, description: "Thưởng nhầm", actorParentId: parent.id });
    await applyLedgerEntry(db, { familyId: family.id, childId: child.id, kind: "adhoc", amount: 20, description: "Thưởng", actorParentId: parent.id });
    const adjust = () => recordAdjustment(db, { familyId: family.id, originalTransactionId: original.id, reason: "bấm nhầm", actorParentId: parent.id });
    const results = await Promise.allSettled([adjust(), adjust(), adjust()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await getBalance(db, child.id)).toBe(20);
  });

  it("Nhiều lần đăng nhập sai đồng thời: chỉ tối đa 5 lần được kiểm tra mật khẩu", async () => {
    const email = `race-${randomUUID()}@example.com`;
    await registerParent(db, { email, password: "matkhau123", displayName: "Mẹ" }, { ip: `signup-${randomUUID()}` });
    const run = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => loginParent(db, { email, password: `sai${i}` }, { ip: `${run}-${i}` })),
    );
    const codes = results.map((r) => (r.status === "rejected" ? (r.reason as { code?: string }).code : "OK"));
    expect(codes.filter((c) => c === "INVALID_CREDENTIALS").length).toBeLessThanOrEqual(5);
    expect(codes.filter((c) => c === "LOCKED").length).toBeGreaterThanOrEqual(7);
    await expect(loginParent(db, { email, password: "matkhau123" }, { ip: `${run}-ok` })).rejects.toMatchObject({ code: "LOCKED" });
  });
});
