import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DAY, fixedClock } from "@/server/clock";
import * as schema from "@/server/db/schema";
import { runMigrations } from "@/server/db/migrate";
import type { Db } from "@/server/db/types";
import { approveProposal, createProposal } from "@/server/domain/adhoc-proposals";
import { approveTaskDay, createTask, reportDone } from "@/server/domain/daily-tasks";
import { applyLedgerEntry, getBalance } from "@/server/domain/ledger";
import { approveClaim, createClaim } from "@/server/domain/rule-claims";
import { createRule } from "@/server/domain/rules";
import { approveRedemption, createRedemption, createReward } from "@/server/domain/shop";
import { seedFamily } from "../helpers/seed";

// Task 8.1 (design D11): duyệt đồng thời trên Postgres thật. PGlite chỉ có một kết nối nên không tái hiện được.
// Cần DATABASE_URL_TEST; không có thì bỏ qua (xem ledger-race.test.ts).

const url = process.env.DATABASE_URL_TEST;

describe.skipIf(!url)("Duyệt đồng thời", () => {
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

  /** Gia đình có hai bố mẹ và một con. */
  async function family(prefix: string) {
    const { family, parent, kids } = await seedFamily(db, { familyName: `${prefix}-${randomUUID()}` });
    const [mom] = await db
      .insert(schema.parents)
      .values({ familyId: family.id, email: `me-${randomUUID()}@example.com`, displayName: "Mẹ", passwordHash: "x" })
      .returning();
    const give = (amount: number, description: string) =>
      applyLedgerEntry(db, { familyId: family.id, childId: kids[0].id, kind: "adhoc", amount, description, actorParentId: parent.id });
    return { familyId: family.id, dad: parent.id, mom: mom.id, child: kids[0], give };
  }

  const countTxns = async (refType: string, refId: number) =>
    (await db.select().from(schema.transactions).where(eq(schema.transactions.refId, refId))).filter((t) => t.refType === refType).length;

  it("Hai lần duyệt cùng một yêu cầu đổi thưởng: chỉ trừ một lần", async () => {
    const { familyId, dad, mom, child, give } = await family("race-redeem");
    await give(100, "Thưởng");
    for (let round = 0; round < 5; round++) {
      const reward = await createReward(db, familyId, { name: `Kem ${round}`, price: 10 });
      const req = await createRedemption(db, { familyId, childId: child.id, rewardId: reward.id });
      const results = await Promise.allSettled([
        approveRedemption(db, { familyId, actorParentId: dad, redemptionId: req.id }),
        approveRedemption(db, { familyId, actorParentId: mom, redemptionId: req.id }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
      expect(await countTxns("redemption", req.id)).toBe(1);
      expect(await getBalance(db, child.id)).toBe(100 - 10 * (round + 1));
    }
  });

  it("Duyệt đổi thưởng song song với phạt: số dư không âm, đổi thưởng bị từ chối nếu không đủ", async () => {
    const { familyId, dad, mom, child, give } = await family("race-redeem-penalty");
    for (let round = 0; round < 5; round++) {
      const start = await getBalance(db, child.id);
      await give(20 - start, "Thưởng cho đủ 20");
      const reward = await createReward(db, familyId, { name: `Đồ chơi ${round}`, price: 15 });
      const req = await createRedemption(db, { familyId, childId: child.id, rewardId: reward.id });
      const [approve, penalty] = await Promise.allSettled([
        approveRedemption(db, { familyId, actorParentId: dad, redemptionId: req.id }),
        applyLedgerEntry(db, { familyId, childId: child.id, kind: "adhoc", amount: -10, description: "Phạt", actorParentId: mom }),
      ]);
      const balance = await getBalance(db, child.id);
      expect(balance).toBeGreaterThanOrEqual(0);
      expect(penalty.status).toBe("fulfilled");
      if (approve.status === "fulfilled") {
        // Duyệt chạy trước: 20 − 15 = 5, phạt chỉ trừ được 5.
        expect(balance).toBe(0);
      } else {
        // Phạt chạy trước: 20 − 10 = 10 < 15 nên đổi thưởng bị từ chối, không trừ.
        expect(approve.reason).toMatchObject({ code: "INSUFFICIENT_BALANCE" });
        expect(await countTxns("redemption", req.id)).toBe(0);
        expect(balance).toBe(10);
      }
    }
  });

  it("Hai bố mẹ duyệt cùng một yêu cầu khai rule: chỉ cộng một lần", async () => {
    const { familyId, dad, mom, child } = await family("race-claim");
    const rule = await createRule(db, familyId, { name: "Đọc sách", kind: "reward", points: 5 });
    for (let round = 0; round < 5; round++) {
      const claim = await createClaim(db, { familyId, childId: child.id, ruleId: rule.id });
      const results = await Promise.allSettled([
        approveClaim(db, { familyId, actorParentId: dad, claimId: claim.id }),
        approveClaim(db, { familyId, actorParentId: mom, claimId: claim.id }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await countTxns("rule_claim", claim.id)).toBe(1);
    }
    expect(await getBalance(db, child.id)).toBe(25);
  });

  it("Hai bố mẹ duyệt cùng một đề xuất ngoài rule: chỉ ghi một giao dịch, theo số điểm của người duyệt được", async () => {
    const { familyId, dad, mom, child } = await family("race-proposal");
    let expected = 0;
    for (let round = 0; round < 5; round++) {
      const proposal = await createProposal(db, { familyId, childId: child.id, kind: "reward", description: `Việc tốt ${round}`, points: 10 });
      const results = await Promise.allSettled([
        approveProposal(db, { familyId, actorParentId: dad, proposalId: proposal.id }),
        approveProposal(db, { familyId, actorParentId: mom, proposalId: proposal.id, points: 4 }),
      ]);
      const done = results.filter((r) => r.status === "fulfilled");
      expect(done).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
      expect(await countTxns("adhoc_proposal", proposal.id)).toBe(1);
      const [row] = await db.select().from(schema.adhocProposals).where(eq(schema.adhocProposals.id, proposal.id));
      expect(row.status).toBe("approved");
      expect(row.approvedPoints).toBe(done[0].value.appliedAmount);
      expected += row.approvedPoints!;
    }
    expect(await getBalance(db, child.id)).toBe(expected);
  });

  it("Hai bố mẹ duyệt cùng một nhiệm vụ trong ngày: chỉ cộng một lần", async () => {
    const { familyId, dad, mom, child } = await family("race-task-approve");
    await db.update(schema.children).set({ createdAt: new Date("2026-01-01T00:00:00Z") }).where(eq(schema.children.id, child.id));
    const created = fixedClock("2026-11-09T03:00:00Z");
    const today = fixedClock(new Date(created.now().getTime() + DAY));
    for (let round = 0; round < 5; round++) {
      const task = await createTask(
        db,
        familyId,
        { name: `Tưới cây ${round}`, points: 3, weekdays: [0, 1, 2, 3, 4, 5, 6], mode: "individual", assignAll: false, childIds: [child.id] },
        created,
      );
      const item = await reportDone(db, { familyId, childId: child.id }, task.id, today);
      const approve = (actorParentId: number) => approveTaskDay(db, { familyId, actorParentId, taskId: task.id, date: item.date, childId: child.id }, today);
      const results = await Promise.allSettled([approve(dad), approve(mom)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    }
    expect(await getBalance(db, child.id)).toBe(15);
  });
});
