import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveProposal,
  cancelProposal,
  createProposal,
  DESCRIPTION_REQUIRED_MESSAGES,
  listChildProposals,
  listPendingProposals,
  MAX_PENDING_PROPOSALS,
  PENDING_LIMIT_MESSAGE,
  rejectProposal,
} from "@/server/domain/adhoc-proposals";
import { applyLedgerEntry, getBalance, listTransactions } from "@/server/domain/ledger";
import { getUnreadSummary } from "@/server/domain/notifications";
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
      await expect(propose({ description })).rejects.toMatchObject({ code: "INVALID_INPUT", message: DESCRIPTION_REQUIRED_MESSAGES.reward });
      await expect(propose({ description, kind: "penalty" })).rejects.toMatchObject({ message: DESCRIPTION_REQUIRED_MESSAGES.penalty });
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

  it("Gửi lại sau khi được xử lý: bố mẹ duyệt một và từ chối một thì gửi thêm được hai", async () => {
    const { familyId, actor, bin, propose } = await setup();
    const ids: number[] = [];
    for (let i = 0; i < MAX_PENDING_PROPOSALS; i++) ids.push((await propose({ description: `Việc ${i}` })).id);
    await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: ids[0] });
    await rejectProposal(t.db, { familyId, actorParentId: actor, proposalId: ids[1] });
    await propose({ description: "Việc mới 1" });
    await propose({ description: "Việc mới 2" });
    await expect(propose({ description: "Việc mới 3" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(MAX_PENDING_PROPOSALS);
  });
});

describe("Bố mẹ duyệt đề xuất ngoài rule", () => {
  async function withBalance(balance: number) {
    const s = await setup();
    if (balance > 0) {
      await applyLedgerEntry(t.db, { familyId: s.familyId, childId: s.bin.id, kind: "adhoc", amount: balance, description: "Có sẵn", actorParentId: s.actor });
    }
    const proposed = (await listTransactions(t.db, { familyId: s.familyId })).rows.length;
    const newTxns = async () => (await listTransactions(t.db, { familyId: s.familyId })).rows.length - proposed;
    return { ...s, newTxns };
  }
  /** Thông báo chưa đọc mới nhất của con. */
  const lastUnread = async (childId: number) => (await getUnreadSummary(t.db, childId)).items.at(-1);

  it("Duyệt giữ nguyên số điểm: đã duyệt, giao dịch +10 đột xuất với mô tả của con, thông báo nhận quà", async () => {
    const { familyId, actor, bin, propose } = await withBalance(0);
    const proposal = await propose();
    const txn = await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id });
    expect(txn).toMatchObject({
      kind: "adhoc",
      requestedAmount: 10,
      appliedAmount: 10,
      description: "Giúp bà xách đồ",
      actorParentId: actor,
      refType: "adhoc_proposal",
      refId: proposal.id,
    });
    expect((await listChildProposals(t.db, bin.id, "approved"))[0]).toMatchObject({ proposedPoints: 10, approvedPoints: 10, decidedByParentId: actor });
    expect(await getBalance(t.db, bin.id)).toBe(10);
    expect(await lastUnread(bin.id)).toMatchObject({ kind: "gift", title: "Giúp bà xách đồ", amount: 10 });
  });

  it("Duyệt với số điểm đã sửa: sổ cái +8, lưu cả số đề xuất (20) lẫn số được duyệt (8), thông báo +8", async () => {
    const { familyId, actor, bin, propose } = await withBalance(0);
    const proposal = await propose({ points: 20 });
    const txn = await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id, points: 8 });
    expect(txn).toMatchObject({ requestedAmount: 8, appliedAmount: 8 });
    expect((await listChildProposals(t.db, bin.id, "approved"))[0]).toMatchObject({ proposedPoints: 20, approvedPoints: 8 });
    expect(await getBalance(t.db, bin.id)).toBe(8);
    expect(await lastUnread(bin.id)).toMatchObject({ kind: "gift", title: "Giúp bà xách đồ", amount: 8 });
  });

  it("Duyệt tự nhận phạt 5 của con đang có 30: giao dịch -5 đột xuất, còn 25, thông báo bị trừ điểm", async () => {
    const { familyId, actor, bin, propose } = await withBalance(30);
    const proposal = await propose({ kind: "penalty", description: "Con làm vỡ cốc", points: 5 });
    const txn = await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id });
    expect(txn).toMatchObject({ kind: "adhoc", requestedAmount: -5, appliedAmount: -5, description: "Con làm vỡ cốc" });
    expect(await getBalance(t.db, bin.id)).toBe(25);
    expect(await lastUnread(bin.id)).toMatchObject({ kind: "penalty", title: "Con làm vỡ cốc", amount: -5 });
  });

  it("Tự nhận phạt lớn hơn số dư: mức gốc -10, thực trừ -4, số dư còn 0, thông báo ghi số thực trừ", async () => {
    const { familyId, actor, bin, propose } = await withBalance(4);
    const proposal = await propose({ kind: "penalty", description: "Con làm vỡ cốc", points: 10 });
    const txn = await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id });
    expect(txn).toMatchObject({ requestedAmount: -10, appliedAmount: -4 });
    expect(await getBalance(t.db, bin.id)).toBe(0);
    expect((await listChildProposals(t.db, bin.id, "approved"))[0]).toMatchObject({ approvedPoints: 10 });
    expect(await lastUnread(bin.id)).toMatchObject({ kind: "penalty", amount: -4, requestedAmount: -10 });
  });

  it("Số điểm sửa không hợp lệ: từ chối, đề xuất vẫn chờ duyệt, không có giao dịch", async () => {
    const { familyId, actor, bin, propose, newTxns } = await withBalance(0);
    const proposal = await propose();
    for (const points of [0, -3, 2.5, NaN, 100_001]) {
      await expect(approveProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id, points })).rejects.toMatchObject({
        code: "INVALID_INPUT",
        message: POINTS_MESSAGE,
      });
    }
    expect((await listChildProposals(t.db, bin.id))[0]).toMatchObject({ id: proposal.id, status: "pending", approvedPoints: null });
    expect(await newTxns()).toBe(0);
    expect((await getUnreadSummary(t.db, bin.id)).items).toEqual([]);
  });

  it("Từ chối đề xuất: bị từ chối, con thấy lý do, không có giao dịch", async () => {
    const { familyId, actor, bin, propose, newTxns } = await withBalance(0);
    const proposal = await propose();
    await rejectProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id, reason: " Việc này là việc con phải làm " });
    expect((await listChildProposals(t.db, bin.id, "rejected"))[0]).toMatchObject({ reason: "Việc này là việc con phải làm", approvedPoints: null });
    expect(await lastUnread(bin.id)).toMatchObject({
      kind: "rejected",
      title: "Giúp bà xách đồ",
      reason: "Việc này là việc con phải làm",
      refType: "adhoc_proposal",
      refId: proposal.id,
    });
    expect(await newTxns()).toBe(0);
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });

  it("Từ chối không kèm lý do: vẫn có thông báo bị từ chối", async () => {
    const { familyId, actor, bin, propose } = await withBalance(0);
    const proposal = await propose({ kind: "penalty", description: "Con làm vỡ cốc", points: 5 });
    await rejectProposal(t.db, { familyId, actorParentId: actor, proposalId: proposal.id });
    expect(await lastUnread(bin.id)).toMatchObject({ kind: "rejected", title: "Con làm vỡ cốc", reason: null });
  });

  it("Duyệt lần hai: đề xuất đã duyệt, đã từ chối hoặc đã hủy đều bị từ chối, không ghi thêm giao dịch", async () => {
    const { familyId, actor, bin, propose, newTxns } = await withBalance(0);
    const approved = await propose({ description: "Đã duyệt" });
    const rejected = await propose({ description: "Đã từ chối" });
    const cancelled = await propose({ description: "Đã hủy" });
    await approveProposal(t.db, { familyId, actorParentId: actor, proposalId: approved.id });
    await rejectProposal(t.db, { familyId, actorParentId: actor, proposalId: rejected.id });
    await cancelProposal(t.db, { childId: bin.id, proposalId: cancelled.id });

    for (const proposalId of [approved.id, rejected.id, cancelled.id]) {
      await expect(approveProposal(t.db, { familyId, actorParentId: actor, proposalId, points: 3 })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(rejectProposal(t.db, { familyId, actorParentId: actor, proposalId })).rejects.toMatchObject({ code: "CONFLICT" });
    }
    expect(await newTxns()).toBe(1);
    expect(await getBalance(t.db, bin.id)).toBe(10);
    expect((await listChildProposals(t.db, bin.id, "approved"))[0]).toMatchObject({ approvedPoints: 10 });
  });

  it("Đề xuất của gia đình khác: từ chối như thể không tồn tại, đề xuất vẫn chờ duyệt", async () => {
    const { bin, propose } = await withBalance(0);
    const proposal = await propose();
    const other = await seedFamily(t.db, { familyName: "Khác" });
    const asOther = { familyId: other.family.id, actorParentId: other.parent.id, proposalId: proposal.id };
    await expect(approveProposal(t.db, asOther)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(rejectProposal(t.db, asOther)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listChildProposals(t.db, bin.id)).toHaveLength(1);
    expect(await getBalance(t.db, bin.id)).toBe(0);
  });
});
