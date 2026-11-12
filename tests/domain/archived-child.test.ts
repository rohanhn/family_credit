import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approveProposal, createProposal, listPendingProposals, rejectProposal } from "@/server/domain/adhoc-proposals";
import { archiveChild } from "@/server/domain/children";
import { applyLedgerEntry, CHILD_ARCHIVED_MESSAGE, getBalance, recordAdjustment } from "@/server/domain/ledger";
import { approveClaim, createClaim, listPendingClaims, rejectClaim } from "@/server/domain/rule-claims";
import { applyAdhoc, applyRule, createRule } from "@/server/domain/rules";
import { approveRedemption, createRedemption, createReward, listPendingRedemptions } from "@/server/domain/shop";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

// Spec family-accounts "Quản lý hồ sơ con": con đã lưu trữ (design D1).

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

async function setup() {
  const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
  const familyId = family.id;
  const actorParentId = parent.id;
  const bin = kids[0].id;
  const give = (amount: number) =>
    applyLedgerEntry(t.db, { familyId, childId: bin, kind: "adhoc", amount, description: "Thưởng", actorParentId });
  return { familyId, actorParentId, bin, give };
}

describe("Con đã lưu trữ", () => {
  it("Không ghi điểm mới: áp dụng rule và thưởng/phạt đột xuất bị từ chối, số dư không đổi", async () => {
    const { familyId, actorParentId, bin, give } = await setup();
    await give(10);
    const reward = await createRule(t.db, familyId, { name: "Đánh răng", kind: "reward", points: 5 });
    const penalty = await createRule(t.db, familyId, { name: "Nói dối", kind: "penalty", points: 3 });
    await archiveChild(t.db, familyId, bin);

    for (const ruleId of [reward.id, penalty.id]) {
      await expect(applyRule(t.db, { familyId, actorParentId, childId: bin, ruleId })).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: CHILD_ARCHIVED_MESSAGE,
      });
    }
    for (const kind of ["reward", "penalty"]) {
      await expect(
        applyAdhoc(t.db, { familyId, actorParentId, childId: bin, kind, points: 4, reason: "Lý do" }),
      ).rejects.toMatchObject({ message: CHILD_ARCHIVED_MESSAGE });
    }
    await expect(give(1)).rejects.toMatchObject({ message: CHILD_ARCHIVED_MESSAGE });
    expect(await getBalance(t.db, bin)).toBe(10);
  });

  it("Khai rule gửi trước khi lưu trữ vẫn duyệt hoặc từ chối được", async () => {
    const { familyId, actorParentId, bin } = await setup();
    const rule = await createRule(t.db, familyId, { name: "Đọc sách", kind: "reward", points: 5 });
    const c1 = await createClaim(t.db, { familyId, childId: bin, ruleId: rule.id });
    const c2 = await createClaim(t.db, { familyId, childId: bin, ruleId: rule.id });
    await archiveChild(t.db, familyId, bin);
    expect((await listPendingClaims(t.db, familyId)).map((c) => [c.childName, c.childArchived])).toEqual([
      ["Bin", true],
      ["Bin", true],
    ]);

    await approveClaim(t.db, { familyId, actorParentId, claimId: c1.id });
    await rejectClaim(t.db, { familyId, actorParentId, claimId: c2.id });
    expect(await getBalance(t.db, bin)).toBe(5);
  });

  it("Đề xuất ngoài rule gửi trước khi lưu trữ vẫn nằm trong hàng chờ, duyệt hoặc từ chối được", async () => {
    const { familyId, actorParentId, bin, give } = await setup();
    await give(10);
    const reward = await createProposal(t.db, { familyId, childId: bin, kind: "reward", description: "Giúp bà xách đồ", points: 7 });
    const penalty = await createProposal(t.db, { familyId, childId: bin, kind: "penalty", description: "Con làm vỡ cốc", points: 3 });
    const rejected = await createProposal(t.db, { familyId, childId: bin, kind: "reward", description: "Dọn phòng", points: 5 });
    await archiveChild(t.db, familyId, bin);
    expect((await listPendingProposals(t.db, familyId)).map((p) => [p.childName, p.childArchived])).toEqual([
      ["Bin", true],
      ["Bin", true],
      ["Bin", true],
    ]);

    await approveProposal(t.db, { familyId, actorParentId, proposalId: reward.id });
    await approveProposal(t.db, { familyId, actorParentId, proposalId: penalty.id, points: 2 });
    await rejectProposal(t.db, { familyId, actorParentId, proposalId: rejected.id });
    expect(await getBalance(t.db, bin)).toBe(15);
    expect(await listPendingProposals(t.db, familyId)).toEqual([]);
  });

  it("Đổi thưởng gửi trước khi lưu trữ vẫn duyệt được", async () => {
    const { familyId, actorParentId, bin, give } = await setup();
    await give(30);
    const reward = await createReward(t.db, familyId, { name: "Kem", price: 20 });
    const redemption = await createRedemption(t.db, { familyId, childId: bin, rewardId: reward.id });
    await archiveChild(t.db, familyId, bin);
    expect((await listPendingRedemptions(t.db, familyId)).map((r) => [r.childName, r.childArchived])).toEqual([["Bin", true]]);

    await approveRedemption(t.db, { familyId, actorParentId, redemptionId: redemption.id });
    expect(await getBalance(t.db, bin)).toBe(10);
  });

  it("Giao dịch điều chỉnh vẫn ghi được để sửa sai", async () => {
    const { familyId, actorParentId, bin, give } = await setup();
    const txn = await give(10);
    await archiveChild(t.db, familyId, bin);

    await recordAdjustment(t.db, { familyId, originalTransactionId: txn.id, reason: "Ghi nhầm", actorParentId });
    expect(await getBalance(t.db, bin)).toBe(0);
  });
});
