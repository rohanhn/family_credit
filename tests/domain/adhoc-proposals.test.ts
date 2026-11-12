import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cancelProposal,
  createProposal,
  DESCRIPTION_REQUIRED_MESSAGE,
  listChildProposals,
  listPendingProposals,
  MAX_PENDING_PROPOSALS,
  PENDING_LIMIT_MESSAGE,
} from "@/server/domain/adhoc-proposals";
import { getBalance, listTransactions } from "@/server/domain/ledger";
import { POINTS_MESSAGE } from "@/server/domain/rules";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

// Spec reward-rules: đề xuất thưởng/phạt ngoài rule của con.

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

async function setup() {
  const s = await seedFamily(t.db, { kids: ["Bin", "Na"] });
  const familyId = s.family.id;
  const bin = s.kids[0];
  const propose = (over: Partial<{ childId: number; kind: string; description: string; points: number }> = {}) =>
    createProposal(t.db, { familyId, childId: bin.id, kind: "reward", description: "Giúp bà xách đồ", points: 10, ...over });
  return { ...s, familyId, actor: s.parent.id, bin, na: s.kids[1], propose };
}

describe("Con đề xuất thưởng/phạt ngoài rule", () => {
  it("Xin thưởng ngoài rule: đề xuất chờ duyệt với mô tả và số điểm, số dư chưa đổi", async () => {
    const { bin, propose } = await setup();
    const proposal = await propose({ description: "  Giúp bà   xách đồ " });
    expect(proposal).toMatchObject({
      status: "pending",
      kind: "reward",
      description: "Giúp bà xách đồ",
      proposedPoints: 10,
      approvedPoints: null,
    });
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });

  it("Tự nhận phạt ngoài rule: đề xuất chờ duyệt loại phạt, số dư chưa đổi", async () => {
    const { familyId, bin, propose } = await setup();
    const proposal = await propose({ kind: "penalty", description: "Con làm vỡ cốc", points: 5 });
    expect(proposal).toMatchObject({ status: "pending", kind: "penalty", description: "Con làm vỡ cốc", proposedPoints: 5 });
    expect(await getBalance(t.db, bin.id)).toBe(0);
    expect((await listTransactions(t.db, { familyId })).rows).toEqual([]);
  });

  it("Thiếu mô tả: từ chối và yêu cầu nhập mô tả", async () => {
    const { bin, propose } = await setup();
    for (const description of ["", "   "]) {
      await expect(propose({ description })).rejects.toMatchObject({ code: "INVALID_INPUT", message: DESCRIPTION_REQUIRED_MESSAGE });
    }
    await expect(propose({ description: "a".repeat(201) })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await propose({ description: "a".repeat(200) });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(1);
  });

  it("Số điểm không hợp lệ: 0, số âm hoặc không phải số nguyên", async () => {
    const { bin, propose } = await setup();
    for (const points of [0, -5, 2.5, NaN]) {
      await expect(propose({ points })).rejects.toMatchObject({ code: "INVALID_INPUT", message: POINTS_MESSAGE });
    }
    expect(await listChildProposals(t.db, bin.id)).toEqual([]);
  });

  it("Loại không hợp lệ: từ chối", async () => {
    const { propose } = await setup();
    await expect(propose({ kind: "adjust" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("Hủy đề xuất: chuyển đã hủy, không có giao dịch", async () => {
    const { familyId, bin, propose } = await setup();
    const proposal = await propose();
    await cancelProposal(t.db, { childId: bin.id, proposalId: proposal.id });
    expect(await listChildProposals(t.db, bin.id)).toEqual([]);
    expect(await listChildProposals(t.db, bin.id, "cancelled")).toHaveLength(1);
    expect((await listTransactions(t.db, { familyId })).rows).toEqual([]);
    await expect(cancelProposal(t.db, { childId: bin.id, proposalId: proposal.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("Đề xuất cho con khác: không hủy được đề xuất của con khác, không gửi được cho con ngoài gia đình", async () => {
    const { bin, na, propose } = await setup();
    const proposal = await propose();
    await expect(cancelProposal(t.db, { childId: na.id, proposalId: proposal.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(1);
    expect(await listChildProposals(t.db, na.id)).toEqual([]);

    const other = await seedFamily(t.db, { familyName: "Khác" });
    await expect(propose({ childId: other.kids[0].id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Danh sách chờ của gia đình: kèm tên con, cũ nhất trước, không lẫn gia đình khác", async () => {
    const { familyId, na, propose } = await setup();
    const a = await propose();
    const b = await propose({ childId: na.id, kind: "penalty", description: "Con làm vỡ cốc", points: 5 });
    const other = await seedFamily(t.db, { familyName: "Khác" });
    await createProposal(t.db, { familyId: other.family.id, childId: other.kids[0].id, kind: "reward", description: "Việc nhà khác", points: 1 });

    expect((await listPendingProposals(t.db, familyId)).map((p) => [p.id, p.childName, p.kind, p.childArchived])).toEqual([
      [a.id, "Bin", "reward", false],
      [b.id, "Na", "penalty", false],
    ]);
  });
});

describe("Giới hạn đề xuất ngoài rule đang chờ", () => {
  it("Vượt giới hạn: đề xuất thứ 6 bị từ chối, tính chung cả hai loại", async () => {
    const { bin, na, propose } = await setup();
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i++) await propose({ kind: i % 2 ? "penalty" : "reward", description: `Việc ${i}` });
    await expect(propose()).rejects.toMatchObject({ code: "CONFLICT", message: PENDING_LIMIT_MESSAGE });
    await expect(propose({ kind: "penalty" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(MAX_PENDING_PROPOSALS);
    // Giới hạn tính theo từng con.
    await propose({ childId: na.id });
  });

  it("Gửi lại sau khi hủy một đề xuất: đề xuất mới được tạo", async () => {
    const { bin, propose } = await setup();
    const first = await propose();
    for (let i = 1; i < MAX_PENDING_PROPOSALS; i++) await propose({ description: `Việc ${i}` });
    await cancelProposal(t.db, { childId: bin.id, proposalId: first.id });
    await propose({ description: "Việc mới" });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(MAX_PENDING_PROPOSALS);
  });
});
