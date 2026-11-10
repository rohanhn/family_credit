import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyLedgerEntry, getBalance, listTransactions } from "@/server/domain/ledger";
import { getUnreadSummary } from "@/server/domain/notifications";
import { applyAdhoc, applyRule, createRule, listRules, setRuleHidden, updateRule } from "@/server/domain/rules";
import {
  approveClaim,
  cancelClaim,
  createClaim,
  listChildClaims,
  listPendingClaims,
  rejectClaim,
} from "@/server/domain/rule-claims";
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
  const s = await seedFamily(t.db, { kids: ["Bin", "Na"] });
  return { ...s, familyId: s.family.id, actor: s.parent.id, bin: s.kids[0], na: s.kids[1] };
}

describe("Quản lý danh mục rule", () => {
  it("Tạo rule thưởng: xuất hiện trong danh mục rule thưởng", async () => {
    const { familyId } = await setup();
    await createRule(t.db, familyId, { name: "Đánh răng tối", kind: "reward", points: 5 });
    const list = await listRules(t.db, familyId);
    expect(list.filter((r) => r.kind === "reward").map((r) => r.name)).toEqual(["Đánh răng tối"]);
  });

  it("Số điểm không hợp lệ: 0, số âm hoặc không phải số nguyên", async () => {
    const { familyId } = await setup();
    for (const points of [0, -5, 2.5, NaN]) {
      await expect(createRule(t.db, familyId, { name: "X", kind: "reward", points })).rejects.toMatchObject({ message: "Số điểm phải là số nguyên dương" });
    }
  });

  it("Ẩn rule: không hiện trong danh sách áp dụng, hiện lại được", async () => {
    const { familyId, actor, bin } = await setup();
    const rule = await createRule(t.db, familyId, { name: "Nói dối", kind: "penalty", points: 10 });
    await setRuleHidden(t.db, familyId, rule.id, true);
    expect(await listRules(t.db, familyId)).toEqual([]);
    expect(await listRules(t.db, familyId, { includeHidden: true })).toHaveLength(1);
    await expect(applyRule(t.db, { familyId, actorParentId: actor, childId: bin.id, ruleId: rule.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await setRuleHidden(t.db, familyId, rule.id, false);
    expect(await listRules(t.db, familyId)).toHaveLength(1);
  });

  it("Không sửa được rule của gia đình khác", async () => {
    const { familyId } = await setup();
    const rule = await createRule(t.db, familyId, { name: "X", kind: "reward", points: 1 });
    const other = await seedFamily(t.db, { familyName: "Khác" });
    await expect(updateRule(t.db, other.family.id, rule.id, { points: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Sửa rule không ảnh hưởng giao dịch cũ", () => {
  it("Đổi điểm rule từ 5 lên 8: giao dịch cũ vẫn +5, lần sau +8", async () => {
    const { familyId, actor, bin } = await setup();
    const rule = await createRule(t.db, familyId, { name: "Đánh răng tối", kind: "reward", points: 5 });
    await applyRule(t.db, { familyId, actorParentId: actor, childId: bin.id, ruleId: rule.id });
    await updateRule(t.db, familyId, rule.id, { points: 8, name: "Đánh răng buổi tối" });
    await applyRule(t.db, { familyId, actorParentId: actor, childId: bin.id, ruleId: rule.id });
    const rows = (await listTransactions(t.db, { familyId, childId: bin.id })).rows;
    expect(rows.map((r) => [r.description, r.appliedAmount])).toEqual([
      ["Đánh răng buổi tối", 8],
      ["Đánh răng tối", 5],
    ]);
  });
});

describe("Áp dụng rule cho con", () => {
  it("Áp dụng rule thưởng 5 điểm: giao dịch +5 mang tên rule, kèm ghi chú", async () => {
    const { familyId, actor, bin } = await setup();
    const rule = await createRule(t.db, familyId, { name: "Đánh răng tối", kind: "reward", points: 5 });
    const txn = await applyRule(t.db, { familyId, actorParentId: actor, childId: bin.id, ruleId: rule.id, note: "tự giác" });
    expect(txn).toMatchObject({ kind: "rule", appliedAmount: 5, description: "Đánh răng tối (tự giác)", refType: "rule", refId: rule.id });
    expect((await getUnreadSummary(t.db, bin.id)).items[0]).toMatchObject({ kind: "gift", title: "Đánh răng tối", amount: 5 });
  });

  it("Áp dụng rule phạt 10 điểm cho con đang có 30: còn 20", async () => {
    const { familyId, actor, bin } = await setup();
    await applyLedgerEntry(t.db, { familyId, childId: bin.id, kind: "adhoc", amount: 30, description: "Vốn", actorParentId: actor });
    const rule = await createRule(t.db, familyId, { name: "Nói dối", kind: "penalty", points: 10 });
    const txn = await applyRule(t.db, { familyId, actorParentId: actor, childId: bin.id, ruleId: rule.id });
    expect(txn.appliedAmount).toBe(-10);
    expect(await getBalance(t.db, bin.id)).toBe(20);
  });
});

describe("Thưởng/phạt đột xuất", () => {
  it("Thưởng đột xuất 20 điểm với lý do", async () => {
    const { familyId, actor, bin } = await setup();
    const txn = await applyAdhoc(t.db, { familyId, actorParentId: actor, childId: bin.id, kind: "reward", points: 20, reason: "Giúp bà dọn nhà" });
    expect(txn).toMatchObject({ kind: "adhoc", appliedAmount: 20, description: "Giúp bà dọn nhà" });
  });

  it("Thiếu lý do: từ chối", async () => {
    const { familyId, actor, bin } = await setup();
    for (const kind of ["reward", "penalty"]) {
      await expect(applyAdhoc(t.db, { familyId, actorParentId: actor, childId: bin.id, kind, points: 5, reason: "   " })).rejects.toMatchObject({ message: "Cần nhập lý do" });
    }
    expect((await listTransactions(t.db, { familyId })).rows).toEqual([]);
  });
});

describe("Con khai rule thưởng", () => {
  async function withRules() {
    const s = await setup();
    const teeth = await createRule(t.db, s.familyId, { name: "Đánh răng tối", kind: "reward", points: 5 });
    const lie = await createRule(t.db, s.familyId, { name: "Nói dối", kind: "penalty", points: 10 });
    return { ...s, teeth, lie };
  }

  it("Khai rule thưởng: yêu cầu chờ duyệt với tên và điểm, số dư chưa đổi", async () => {
    const { familyId, bin, teeth } = await withRules();
    const claim = await createClaim(t.db, { familyId, childId: bin.id, ruleId: teeth.id, note: "tối qua" });
    expect(claim).toMatchObject({ status: "pending", nameSnapshot: "Đánh răng tối", pointsSnapshot: 5, note: "tối qua" });
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });

  it("Khai nhiều lần: hai yêu cầu riêng, bố mẹ quyết định từng cái", async () => {
    const { familyId, actor, bin, teeth } = await withRules();
    const a = await createClaim(t.db, { familyId, childId: bin.id, ruleId: teeth.id });
    const b = await createClaim(t.db, { familyId, childId: bin.id, ruleId: teeth.id });
    expect((await listPendingClaims(t.db, familyId)).map((c) => c.id)).toEqual([a.id, b.id]);
    await approveClaim(t.db, { familyId, actorParentId: actor, claimId: a.id });
    await rejectClaim(t.db, { familyId, actorParentId: actor, claimId: b.id });
    expect(await getBalance(t.db, bin.id)).toBe(5);
  });

  it("Hủy yêu cầu: chuyển đã hủy, không có giao dịch", async () => {
    const { familyId, bin, na, teeth } = await withRules();
    const claim = await createClaim(t.db, { familyId, childId: bin.id, ruleId: teeth.id });
    await expect(cancelClaim(t.db, { childId: na.id, claimId: claim.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await cancelClaim(t.db, { childId: bin.id, claimId: claim.id });
    expect(await listChildClaims(t.db, bin.id, "cancelled")).toHaveLength(1);
    expect((await listTransactions(t.db, { familyId })).rows).toEqual([]);
  });

  it("Khai rule phạt: từ chối", async () => {
    const { familyId, bin, lie } = await withRules();
    await expect(createClaim(t.db, { familyId, childId: bin.id, ruleId: lie.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("Rule ẩn không khai được", async () => {
    const { familyId, bin, teeth } = await withRules();
    await setRuleHidden(t.db, familyId, teeth.id, true);
    await expect(createClaim(t.db, { familyId, childId: bin.id, ruleId: teeth.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Bố mẹ duyệt khai rule", () => {
  async function pendingClaim() {
    const s = await setup();
    const teeth = await createRule(t.db, s.familyId, { name: "Đánh răng tối", kind: "reward", points: 5 });
    const claim = await createClaim(t.db, { familyId: s.familyId, childId: s.bin.id, ruleId: teeth.id });
    return { ...s, teeth, claim };
  }

  it("Duyệt khai rule: đã duyệt, giao dịch +5 mang tên rule, có thông báo nhận quà", async () => {
    const { familyId, actor, bin, claim } = await pendingClaim();
    const txn = await approveClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id });
    expect(txn).toMatchObject({ kind: "rule", appliedAmount: 5, description: "Đánh răng tối", refType: "rule_claim", refId: claim.id });
    expect(await listChildClaims(t.db, bin.id, "approved")).toHaveLength(1);
    expect((await getUnreadSummary(t.db, bin.id)).items[0]).toMatchObject({ kind: "gift", amount: 5 });
  });

  it("Rule bị sửa trong lúc chờ duyệt: ghi đúng điểm lúc con khai", async () => {
    const { familyId, actor, teeth, claim } = await pendingClaim();
    await updateRule(t.db, familyId, teeth.id, { points: 8 });
    const txn = await approveClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id });
    expect(txn.appliedAmount).toBe(5);
  });

  it("Từ chối khai rule: con thấy lý do, không có giao dịch", async () => {
    const { familyId, actor, bin, claim } = await pendingClaim();
    await rejectClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id, reason: "Con chưa đánh răng" });
    expect((await listChildClaims(t.db, bin.id, "rejected"))[0]).toMatchObject({ reason: "Con chưa đánh răng" });
    expect((await getUnreadSummary(t.db, bin.id)).items[0]).toMatchObject({ kind: "rejected", title: "Đánh răng tối", reason: "Con chưa đánh răng" });
    expect((await listTransactions(t.db, { familyId })).rows).toEqual([]);
  });

  it("Duyệt lần hai: từ chối, không ghi thêm giao dịch", async () => {
    const { familyId, actor, claim } = await pendingClaim();
    await approveClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id });
    await expect(approveClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(rejectClaim(t.db, { familyId, actorParentId: actor, claimId: claim.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await listTransactions(t.db, { familyId })).rows).toHaveLength(1);
  });

  it("Không duyệt được yêu cầu của gia đình khác", async () => {
    const { claim } = await pendingClaim();
    const other = await seedFamily(t.db, { familyName: "Khác" });
    await expect(approveClaim(t.db, { familyId: other.family.id, actorParentId: other.parent.id, claimId: claim.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
