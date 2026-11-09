import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { children, redemptions } from "@/server/db/schema";
import { applyLedgerEntry, getBalance, listTransactions } from "@/server/domain/ledger";
import { getUnreadSummary } from "@/server/domain/notifications";
import {
  approveRedemption,
  cancelRedemption,
  createRedemption,
  createReward,
  getShopView,
  goalProgress,
  listChildRedemptions,
  listPendingRedemptions,
  listRewards,
  rejectRedemption,
  setGoal,
  setRewardHidden,
  updateReward,
} from "@/server/domain/shop";
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

async function give(familyId: number, actor: number, childId: number, amount: number) {
  await applyLedgerEntry(t.db, { familyId, childId, kind: "adhoc", amount, description: "Thưởng", actorParentId: actor });
}

async function goalOf(childId: number) {
  const [c] = await t.db.select({ goal: children.goalRewardId }).from(children).where(eq(children.id, childId));
  return c.goal;
}

describe("Quản lý danh mục phần thưởng", () => {
  it("Tạo phần thưởng: xuất hiện trong cửa hàng của mọi con", async () => {
    const { familyId, bin, na } = await setup();
    await createReward(t.db, familyId, { name: "30 phút chơi game", price: 50, icon: "game" });
    for (const kid of [bin, na]) {
      const view = await getShopView(t.db, familyId, kid.id);
      expect(view.items.map((i) => [i.name, i.price])).toEqual([["30 phút chơi game", 50]]);
    }
  });

  it("Giá không hợp lệ, tên rỗng, icon ngoài bộ có sẵn bị từ chối; icon mặc định là gift", async () => {
    const { familyId } = await setup();
    for (const price of [0, -5, 2.5, NaN]) {
      await expect(createReward(t.db, familyId, { name: "X", price })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    await expect(createReward(t.db, familyId, { name: "  ", price: 10 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createReward(t.db, familyId, { name: "X", price: 10, icon: "rocket" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createReward(t.db, familyId, { name: "X", price: 10, description: "a".repeat(201) })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await createReward(t.db, familyId, { name: "Quà", price: 10 })).icon).toBe("gift");
  });

  it("Ẩn phần thưởng: con không còn thấy, bố mẹ vẫn thấy khi xem cả mục ẩn", async () => {
    const { familyId, bin } = await setup();
    const r = await createReward(t.db, familyId, { name: "Kem", price: 30 });
    await setRewardHidden(t.db, familyId, r.id, true);
    expect((await getShopView(t.db, familyId, bin.id)).items).toEqual([]);
    expect(await listRewards(t.db, familyId, { includeHidden: true })).toHaveLength(1);
    await setRewardHidden(t.db, familyId, r.id, false);
    expect((await getShopView(t.db, familyId, bin.id)).items).toHaveLength(1);
  });

  it("Không sửa được phần thưởng của gia đình khác", async () => {
    const { familyId } = await setup();
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    const r = await createReward(t.db, familyId, { name: "Kem", price: 30 });
    await expect(updateReward(t.db, other.family.id, r.id, { price: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setRewardHidden(t.db, other.family.id, r.id, true)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Con xem cửa hàng", () => {
  it("Đủ và chưa đủ điểm: 60 điểm, giá 50 đổi được, giá 200 còn thiếu 140", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    await createReward(t.db, familyId, { name: "Game", price: 50 });
    await createReward(t.db, familyId, { name: "Công viên", price: 200 });
    const view = await getShopView(t.db, familyId, bin.id);
    expect(view.balance).toBe(60);
    expect(view.items.map((i) => [i.name, i.canRedeem, i.missing])).toEqual([
      ["Game", true, 0],
      ["Công viên", false, 140],
    ]);
  });
});

describe("Con gửi yêu cầu đổi thưởng", () => {
  it("Gửi yêu cầu: tạo yêu cầu chờ duyệt với tên và giá, số dư không đổi", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    const r = await createReward(t.db, familyId, { name: "Game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    expect(req).toMatchObject({ status: "pending", priceSnapshot: 50, nameSnapshot: "Game" });
    expect(await getBalance(t.db, bin.id)).toBe(60);
    expect(await listTransactions(t.db, { familyId, childId: bin.id, kinds: ["redeem"] })).toEqual([]);
  });

  it("Không đủ điểm: 30 điểm đổi phần thưởng giá 50 bị từ chối", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 30);
    const r = await createReward(t.db, familyId, { name: "Game", price: 50 });
    await expect(createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id })).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
      details: { missing: 20 },
    });
  });

  it("Đã có yêu cầu đang chờ cho phần thưởng đó: gửi thêm bị từ chối, thẻ hiện Chờ duyệt", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 200);
    const r = await createReward(t.db, familyId, { name: "Kem ốc quế", price: 80 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await expect(createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id })).rejects.toMatchObject({ code: "CONFLICT" });
    const item = (await getShopView(t.db, familyId, bin.id)).items[0];
    expect(item).toMatchObject({ pendingRedemptionId: req.id, canRedeem: false });
  });

  it("Partial unique index chặn hai yêu cầu đang chờ cho cùng phần thưởng ở tầng DB", async () => {
    const { familyId, bin } = await setup();
    const r = await createReward(t.db, familyId, { name: "Kem", price: 10 });
    const row = { childId: bin.id, rewardId: r.id, nameSnapshot: "Kem", priceSnapshot: 10 };
    await t.db.insert(redemptions).values(row);
    await expect(t.db.insert(redemptions).values(row)).rejects.toThrow();
    // Yêu cầu đã xử lý không tính.
    await t.db.insert(redemptions).values({ ...row, status: "cancelled" });
  });

  it("Gửi lại được sau khi yêu cầu trước đã hủy; con khác gửi song song được", async () => {
    const { familyId, actor, bin, na } = await setup();
    await give(familyId, actor, bin.id, 100);
    await give(familyId, actor, na.id, 100);
    const r = await createReward(t.db, familyId, { name: "Kem", price: 50 });
    const first = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await createRedemption(t.db, { familyId, childId: na.id, rewardId: r.id });
    await cancelRedemption(t.db, { childId: bin.id, redemptionId: first.id });
    await expect(createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id })).resolves.toMatchObject({ status: "pending" });
  });

  it("Không gửi được cho phần thưởng đã ẩn hoặc của gia đình khác", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 100);
    const hidden = await createReward(t.db, familyId, { name: "Kem", price: 10 });
    await setRewardHidden(t.db, familyId, hidden.id, true);
    await expect(createRedemption(t.db, { familyId, childId: bin.id, rewardId: hidden.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    const foreign = await createReward(t.db, other.family.id, { name: "Lạ", price: 10 });
    await expect(createRedemption(t.db, { familyId, childId: bin.id, rewardId: foreign.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Hủy yêu cầu: chuyển sang đã hủy, không ghi giao dịch; không hủy được yêu cầu của con khác hay đã xử lý", async () => {
    const { familyId, actor, bin, na } = await setup();
    await give(familyId, actor, bin.id, 60);
    const r = await createReward(t.db, familyId, { name: "Game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await expect(cancelRedemption(t.db, { childId: na.id, redemptionId: req.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await cancelRedemption(t.db, { childId: bin.id, redemptionId: req.id });
    expect((await listChildRedemptions(t.db, bin.id, "cancelled")).map((x) => x.id)).toEqual([req.id]);
    expect(await getBalance(t.db, bin.id)).toBe(60);
    await expect(cancelRedemption(t.db, { childId: bin.id, redemptionId: req.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Bố mẹ duyệt yêu cầu đổi thưởng", () => {
  it("Duyệt yêu cầu: giao dịch -50 loại đổi thưởng, số dư còn 10, con nhận thông báo nhận quà", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    const r = await createReward(t.db, familyId, { name: "30 phút chơi game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    expect(await listPendingRedemptions(t.db, familyId)).toMatchObject([{ id: req.id, childName: "Bin", balance: 60 }]);

    const txn = await approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id });
    expect(txn).toMatchObject({ kind: "redeem", requestedAmount: -50, appliedAmount: -50, refType: "redemption", refId: req.id });
    expect(await getBalance(t.db, bin.id)).toBe(10);
    expect((await listChildRedemptions(t.db, bin.id, "approved"))[0]).toMatchObject({ id: req.id, decidedByParentId: actor });
    expect(await listPendingRedemptions(t.db, familyId)).toEqual([]);

    const unread = await getUnreadSummary(t.db, bin.id);
    expect(unread.items.at(-1)).toMatchObject({ kind: "gift", title: "Bố mẹ đã duyệt: 30 phút chơi game", amount: -50 });
  });

  it("Số dư đã giảm trước khi duyệt: duyệt yêu cầu thứ hai bị từ chối kèm lý do", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    const a = await createReward(t.db, familyId, { name: "Game", price: 50 });
    const b = await createReward(t.db, familyId, { name: "Kem", price: 50 });
    const r1 = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: a.id });
    const r2 = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: b.id });
    await approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: r1.id });
    await expect(approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: r2.id })).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
      message: "Không duyệt được: con chỉ còn 10, cần 50",
    });
    expect(await getBalance(t.db, bin.id)).toBe(10);
    expect((await listChildRedemptions(t.db, bin.id, "pending")).map((x) => x.id)).toEqual([r2.id]);
  });

  it("Duyệt hai lần: lần hai báo đã xử lý, chỉ trừ một lần", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 200);
    const r = await createReward(t.db, familyId, { name: "Game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id });
    await expect(approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(rejectRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await getBalance(t.db, bin.id)).toBe(150);
  });

  it("Phần thưởng bị sửa hoặc ẩn trong lúc chờ: trừ theo tên và giá đã chụp", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 200);
    const r = await createReward(t.db, familyId, { name: "Kem ốc quế", price: 80 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await updateReward(t.db, familyId, r.id, { name: "Kem que", price: 100 });
    await setRewardHidden(t.db, familyId, r.id, true);
    const txn = await approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id });
    expect(txn).toMatchObject({ appliedAmount: -80, description: "Đổi thưởng: Kem ốc quế" });
  });

  it("Từ chối yêu cầu: con thấy lý do, số dư không đổi, có thông báo bị từ chối", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    const r = await createReward(t.db, familyId, { name: "30 phút chơi game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await rejectRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id, reason: "Tối nay không chơi game" });
    expect((await listChildRedemptions(t.db, bin.id, "rejected"))[0]).toMatchObject({ id: req.id, reason: "Tối nay không chơi game" });
    expect(await getBalance(t.db, bin.id)).toBe(60);
    const unread = await getUnreadSummary(t.db, bin.id);
    expect(unread.items.at(-1)).toMatchObject({ kind: "rejected", title: "30 phút chơi game", reason: "Tối nay không chơi game" });
  });

  it("Không duyệt hay từ chối được yêu cầu của gia đình khác", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 60);
    const r = await createReward(t.db, familyId, { name: "Game", price: 50 });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    await expect(approveRedemption(t.db, { familyId: other.family.id, actorParentId: other.parent.id, redemptionId: req.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(rejectRedemption(t.db, { familyId: other.family.id, actorParentId: other.parent.id, redemptionId: req.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listPendingRedemptions(t.db, other.family.id)).toEqual([]);
  });
});

describe("Mục tiêu tiết kiệm", () => {
  it("goalProgress: phần trăm làm tròn xuống, giới hạn 100%", () => {
    expect(goalProgress(40, 200)).toEqual({ percent: 20, remaining: 160, reached: false });
    expect(goalProgress(199, 200)).toEqual({ percent: 99, remaining: 1, reached: false });
    expect(goalProgress(250, 200)).toEqual({ percent: 100, remaining: 0, reached: true });
    expect(goalProgress(0, 200)).toEqual({ percent: 0, remaining: 200, reached: false });
  });

  it("Chọn mục tiêu: 40 điểm, Đi công viên giá 200 → 20%, còn 160", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 40);
    const r = await createReward(t.db, familyId, { name: "Đi công viên", price: 200, icon: "park" });
    await setGoal(t.db, { familyId, childId: bin.id, rewardId: r.id });
    const view = await getShopView(t.db, familyId, bin.id);
    expect(view.goal).toMatchObject({ id: r.id, percent: 20, remaining: 160, reached: false });
    expect(view.items[0].isGoal).toBe(true);
  });

  it("Đạt mục tiêu: số dư vượt giá thì 100% và đổi được", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 250);
    const r = await createReward(t.db, familyId, { name: "Đi công viên", price: 200 });
    await setGoal(t.db, { familyId, childId: bin.id, rewardId: r.id });
    expect((await getShopView(t.db, familyId, bin.id)).goal).toMatchObject({ percent: 100, reached: true, canRedeem: true });
  });

  it("Mục tiêu bị ẩn: bỏ chọn cho mọi con đang chọn, hiện lại không tự chọn lại", async () => {
    const { familyId, bin, na } = await setup();
    const r = await createReward(t.db, familyId, { name: "Đi công viên", price: 200 });
    const keep = await createReward(t.db, familyId, { name: "Kem", price: 20 });
    await setGoal(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await setGoal(t.db, { familyId, childId: na.id, rewardId: keep.id });
    await setRewardHidden(t.db, familyId, r.id, true);
    expect(await goalOf(bin.id)).toBeNull();
    expect(await goalOf(na.id)).toBe(keep.id);
    expect((await getShopView(t.db, familyId, bin.id)).goal).toBeNull();
    await setRewardHidden(t.db, familyId, r.id, false);
    expect(await goalOf(bin.id)).toBeNull();
  });

  it("Đổi thành công phần thưởng mục tiêu: vẫn giữ mục tiêu, tiến độ tính theo số dư mới", async () => {
    const { familyId, actor, bin } = await setup();
    await give(familyId, actor, bin.id, 250);
    const r = await createReward(t.db, familyId, { name: "Đi công viên", price: 200 });
    await setGoal(t.db, { familyId, childId: bin.id, rewardId: r.id });
    const req = await createRedemption(t.db, { familyId, childId: bin.id, rewardId: r.id });
    await approveRedemption(t.db, { familyId, actorParentId: actor, redemptionId: req.id });
    expect((await getShopView(t.db, familyId, bin.id)).goal).toMatchObject({ id: r.id, percent: 25, remaining: 150 });
  });

  it("Không chọn được phần thưởng đã ẩn hoặc của gia đình khác; bỏ mục tiêu được", async () => {
    const { familyId, bin } = await setup();
    const r = await createReward(t.db, familyId, { name: "Kem", price: 20 });
    await setRewardHidden(t.db, familyId, r.id, true);
    await expect(setGoal(t.db, { familyId, childId: bin.id, rewardId: r.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const other = await seedFamily(t.db, { familyName: "Nhà khác" });
    const foreign = await createReward(t.db, other.family.id, { name: "Lạ", price: 10 });
    await expect(setGoal(t.db, { familyId, childId: bin.id, rewardId: foreign.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await setGoal(t.db, { familyId, childId: bin.id, rewardId: null });
    expect(await goalOf(bin.id)).toBeNull();
  });
});
