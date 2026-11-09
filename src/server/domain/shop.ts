import { and, asc, desc, eq, gte } from "drizzle-orm";
import { DAY, systemClock, type Clock } from "../clock";
import { children, redemptions, rewards } from "../db/schema";
import type { Db, DbOrTx, Tx } from "../db/types";
import { DomainError, invalid, notFound } from "./errors";
import { getBalance, lockChild, recordTransaction, type Transaction } from "./ledger";
import { notifyRejected } from "./notifications";
import { validatePoints } from "./rules";
import { DEFAULT_REWARD_ICON, REWARD_ICONS, type RewardIcon } from "@/lib/reward-icons";

// Cửa hàng đổi thưởng (spec reward-shop, design D3 "Đổi thưởng").
// - Gửi yêu cầu không trừ điểm; tên và giá được chụp lại lúc gửi.
// - Mỗi con tối đa một yêu cầu đang chờ cho mỗi phần thưởng (partial unique index redemptions_pending_uq).
// - Duyệt kiểm tra lại số dư sau khi khóa dòng của con; thiếu thì báo lỗi, không trừ một phần.

export type Reward = typeof rewards.$inferSelect;
export type Redemption = typeof redemptions.$inferSelect;

export { REWARD_ICONS, DEFAULT_REWARD_ICON, type RewardIcon };

export const ALREADY_DECIDED_MESSAGE = "Yêu cầu này đã được xử lý";
export const ALREADY_PENDING_MESSAGE = "Con đã gửi yêu cầu đổi phần thưởng này, đang chờ bố mẹ duyệt";
export const INSUFFICIENT_MESSAGE = "Chưa đủ điểm để đổi phần thưởng này";

// ---------------------------------------------------------------- danh mục phần thưởng

function normalizeName(name: string): string {
  const n = name.trim().replace(/\s+/g, " ");
  if ([...n].length < 1 || [...n].length > 60) throw invalid("Tên phải dài từ 1 đến 60 ký tự");
  return n;
}

function normalizeDescription(description: string | null | undefined): string | null {
  const d = description?.trim().replace(/\s+/g, " ") || null;
  if (d && [...d].length > 200) throw invalid("Mô tả tối đa 200 ký tự");
  return d;
}

function validateIcon(icon: string | null | undefined): RewardIcon {
  if (!icon) return DEFAULT_REWARD_ICON;
  if (!(REWARD_ICONS as readonly string[]).includes(icon)) throw invalid("Icon không hợp lệ");
  return icon as RewardIcon;
}

export async function createReward(
  db: DbOrTx,
  familyId: number,
  input: { name: string; price: number; icon?: string | null; description?: string | null },
): Promise<Reward> {
  const [reward] = await db
    .insert(rewards)
    .values({
      familyId,
      name: normalizeName(input.name),
      price: validatePoints(input.price),
      icon: validateIcon(input.icon),
      description: normalizeDescription(input.description),
    })
    .returning();
  return reward;
}

/** Sửa phần thưởng chỉ ảnh hưởng các yêu cầu gửi sau; yêu cầu đã gửi giữ tên và giá đã chụp. */
export async function updateReward(
  db: DbOrTx,
  familyId: number,
  rewardId: number,
  input: { name?: string; price?: number; icon?: string | null; description?: string | null },
): Promise<Reward> {
  const patch: Partial<typeof rewards.$inferInsert> = {};
  if (input.name !== undefined) patch.name = normalizeName(input.name);
  if (input.price !== undefined) patch.price = validatePoints(input.price);
  if (input.icon !== undefined) patch.icon = validateIcon(input.icon);
  if (input.description !== undefined) patch.description = normalizeDescription(input.description);
  const [reward] = await db.update(rewards).set(patch).where(and(eq(rewards.id, rewardId), eq(rewards.familyId, familyId))).returning();
  if (!reward) throw notFound();
  return reward;
}

/** Ẩn hoặc hiện lại. Ẩn thì bỏ mục tiêu của mọi con đang chọn phần thưởng này, trong cùng transaction. */
export async function setRewardHidden(db: Db, familyId: number, rewardId: number, hidden: boolean): Promise<Reward> {
  return db.transaction(async (tx) => {
    const [reward] = await tx.update(rewards).set({ hidden }).where(and(eq(rewards.id, rewardId), eq(rewards.familyId, familyId))).returning();
    if (!reward) throw notFound();
    if (hidden) {
      await tx
        .update(children)
        .set({ goalRewardId: null })
        .where(and(eq(children.familyId, familyId), eq(children.goalRewardId, rewardId)));
    }
    return reward;
  });
}

export function listRewards(db: DbOrTx, familyId: number, opts: { includeHidden?: boolean } = {}): Promise<Reward[]> {
  const conditions = [eq(rewards.familyId, familyId)];
  if (!opts.includeHidden) conditions.push(eq(rewards.hidden, false));
  return db.select().from(rewards).where(and(...conditions)).orderBy(asc(rewards.price), asc(rewards.id));
}

export async function getVisibleReward(db: DbOrTx, familyId: number, rewardId: number): Promise<Reward> {
  const [reward] = await db
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, rewardId), eq(rewards.familyId, familyId), eq(rewards.hidden, false)));
  if (!reward) throw notFound();
  return reward;
}

// ---------------------------------------------------------------- mục tiêu tiết kiệm

/** Tiến độ mục tiêu: số dư trên giá, giới hạn 100% (spec "Mục tiêu tiết kiệm"). */
export function goalProgress(balance: number, price: number): { percent: number; remaining: number; reached: boolean } {
  const remaining = Math.max(0, price - balance);
  const percent = price > 0 ? Math.min(100, Math.floor((Math.max(0, balance) * 100) / price)) : 0;
  return { percent, remaining, reached: remaining === 0 };
}

/** Con chọn một phần thưởng đang hiện làm mục tiêu, hoặc bỏ mục tiêu (rewardId = null). */
export async function setGoal(db: DbOrTx, input: { familyId: number; childId: number; rewardId: number | null }): Promise<void> {
  if (input.rewardId !== null) await getVisibleReward(db, input.familyId, input.rewardId);
  const rows = await db
    .update(children)
    .set({ goalRewardId: input.rewardId })
    .where(and(eq(children.id, input.childId), eq(children.familyId, input.familyId)))
    .returning({ id: children.id });
  if (rows.length === 0) throw notFound();
}

// ---------------------------------------------------------------- cửa hàng của con

export type ShopItem = Reward & {
  /** Đủ điểm và chưa có yêu cầu đang chờ cho phần thưởng này. */
  canRedeem: boolean;
  /** Số điểm còn thiếu (0 nếu đủ). */
  missing: number;
  pendingRedemptionId: number | null;
  isGoal: boolean;
};

export type ShopView = {
  balance: number;
  goal: (ShopItem & ReturnType<typeof goalProgress>) | null;
  items: ShopItem[];
};

/** Dữ liệu màn cửa hàng của con: phần thưởng đang hiện, trạng thái đủ/thiếu, yêu cầu đang chờ, mục tiêu. */
export async function getShopView(db: DbOrTx, familyId: number, childId: number): Promise<ShopView> {
  const [child] = await db
    .select({ goalRewardId: children.goalRewardId })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  if (!child) throw notFound();
  const [balance, list, pending] = await Promise.all([
    getBalance(db, childId),
    listRewards(db, familyId),
    db
      .select({ id: redemptions.id, rewardId: redemptions.rewardId })
      .from(redemptions)
      .where(and(eq(redemptions.childId, childId), eq(redemptions.status, "pending"))),
  ]);
  const pendingByReward = new Map(pending.map((p) => [p.rewardId, p.id]));
  const items = list.map((r): ShopItem => {
    const pendingRedemptionId = pendingByReward.get(r.id) ?? null;
    const missing = Math.max(0, r.price - balance);
    return { ...r, missing, pendingRedemptionId, canRedeem: missing === 0 && pendingRedemptionId === null, isGoal: r.id === child.goalRewardId };
  });
  const goalItem = items.find((i) => i.isGoal);
  return { balance, items, goal: goalItem ? { ...goalItem, ...goalProgress(balance, goalItem.price) } : null };
}

// ---------------------------------------------------------------- yêu cầu đổi thưởng

/** Con gửi yêu cầu đổi: cần số dư ≥ giá (không trừ các yêu cầu đang chờ khác), không trừ điểm. */
export async function createRedemption(db: Db, input: { familyId: number; childId: number; rewardId: number }): Promise<Redemption> {
  return db.transaction(async (tx) => {
    await lockChild(tx, input.familyId, input.childId);
    const reward = await getVisibleReward(tx, input.familyId, input.rewardId);
    const [existing] = await tx
      .select({ id: redemptions.id })
      .from(redemptions)
      .where(and(eq(redemptions.childId, input.childId), eq(redemptions.rewardId, reward.id), eq(redemptions.status, "pending")));
    if (existing) throw new DomainError("CONFLICT", ALREADY_PENDING_MESSAGE);
    const balance = await getBalance(tx, input.childId);
    if (balance < reward.price) {
      throw new DomainError("INSUFFICIENT_BALANCE", INSUFFICIENT_MESSAGE, { balance, price: reward.price, missing: reward.price - balance });
    }
    const [row] = await tx
      .insert(redemptions)
      .values({ childId: input.childId, rewardId: reward.id, nameSnapshot: reward.name, priceSnapshot: reward.price })
      .returning();
    return row;
  });
}

/** Con hủy yêu cầu còn chờ duyệt của chính mình; không ghi giao dịch. */
export async function cancelRedemption(db: DbOrTx, input: { childId: number; redemptionId: number }, clock: Clock = systemClock): Promise<void> {
  const rows = await db
    .update(redemptions)
    .set({ status: "cancelled", decidedAt: clock.now() })
    .where(and(eq(redemptions.id, input.redemptionId), eq(redemptions.childId, input.childId), eq(redemptions.status, "pending")))
    .returning({ id: redemptions.id });
  if (rows.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
}

/** Yêu cầu của một con theo trạng thái, mới nhất trước (con xem yêu cầu đang chờ và lý do bị từ chối). */
export function listChildRedemptions(db: DbOrTx, childId: number, status: Redemption["status"] = "pending"): Promise<Redemption[]> {
  return db
    .select()
    .from(redemptions)
    .where(and(eq(redemptions.childId, childId), eq(redemptions.status, status)))
    .orderBy(desc(redemptions.id));
}

/** Yêu cầu bị từ chối trong vài ngày gần nhất (con xem lại lý do ở cửa hàng), mới nhất trước. */
export function listRecentRejectedRedemptions(
  db: DbOrTx,
  childId: number,
  opts: { days?: number; limit?: number } = {},
  clock: Clock = systemClock,
): Promise<Redemption[]> {
  const since = new Date(clock.now().getTime() - (opts.days ?? 7) * DAY);
  return db
    .select()
    .from(redemptions)
    .where(and(eq(redemptions.childId, childId), eq(redemptions.status, "rejected"), gte(redemptions.decidedAt, since)))
    .orderBy(desc(redemptions.decidedAt), desc(redemptions.id))
    .limit(opts.limit ?? 3);
}

/** Yêu cầu đổi thưởng đang chờ của cả gia đình (cho hàng chờ duyệt chung), kèm số dư hiện tại của con. */
export async function listPendingRedemptions(db: DbOrTx, familyId: number) {
  const rows = await db
    .select({ redemption: redemptions, childName: children.name })
    .from(redemptions)
    .innerJoin(children, eq(children.id, redemptions.childId))
    .where(and(eq(children.familyId, familyId), eq(redemptions.status, "pending")))
    .orderBy(asc(redemptions.id));
  const balances = new Map<number, number>();
  for (const r of rows) {
    if (!balances.has(r.redemption.childId)) balances.set(r.redemption.childId, await getBalance(db, r.redemption.childId));
  }
  return rows.map((r) => ({ ...r.redemption, childName: r.childName, balance: balances.get(r.redemption.childId)! }));
}

/** Khóa yêu cầu của gia đình trong transaction; NOT_FOUND nếu thuộc gia đình khác. */
async function lockRedemption(tx: Tx, familyId: number, redemptionId: number): Promise<Redemption> {
  const [row] = await tx
    .select({ redemption: redemptions })
    .from(redemptions)
    .innerJoin(children, eq(children.id, redemptions.childId))
    .where(and(eq(redemptions.id, redemptionId), eq(children.familyId, familyId)))
    .for("update", { of: redemptions });
  if (!row) throw notFound();
  return row.redemption;
}

/**
 * Duyệt: khóa dòng của con, kiểm tra lại số dư, chuyển pending → approved có điều kiện và ghi giao dịch
 * -price_snapshot loại "redeem", tất cả trong một transaction. Không phụ thuộc trạng thái hiện tại của phần thưởng.
 */
export async function approveRedemption(
  db: Db,
  input: { familyId: number; actorParentId: number; redemptionId: number },
  clock: Clock = systemClock,
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const redemption = await lockRedemption(tx, input.familyId, input.redemptionId);
    if (redemption.status !== "pending") throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    await lockChild(tx, input.familyId, redemption.childId);
    const balance = await getBalance(tx, redemption.childId);
    if (balance < redemption.priceSnapshot) {
      throw new DomainError("INSUFFICIENT_BALANCE", `Không duyệt được: con chỉ còn ${balance}, cần ${redemption.priceSnapshot}`, {
        balance,
        price: redemption.priceSnapshot,
      });
    }
    const updated = await tx
      .update(redemptions)
      .set({ status: "approved", decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(redemptions.id, redemption.id), eq(redemptions.status, "pending")))
      .returning({ id: redemptions.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    return recordTransaction(tx, {
      familyId: input.familyId,
      childId: redemption.childId,
      kind: "redeem",
      amount: -redemption.priceSnapshot,
      description: `Đổi thưởng: ${redemption.nameSnapshot}`,
      actorParentId: input.actorParentId,
      refType: "redemption",
      refId: redemption.id,
      notifyTitle: `Bố mẹ đã duyệt: ${redemption.nameSnapshot}`,
    });
  });
}

/** Từ chối kèm lý do tùy chọn: không ghi giao dịch, con nhận thông báo "bị từ chối". */
export async function rejectRedemption(
  db: Db,
  input: { familyId: number; actorParentId: number; redemptionId: number; reason?: string },
  clock: Clock = systemClock,
): Promise<void> {
  await db.transaction(async (tx) => {
    const redemption = await lockRedemption(tx, input.familyId, input.redemptionId);
    const reason = input.reason?.trim() || null;
    const updated = await tx
      .update(redemptions)
      .set({ status: "rejected", reason, decidedByParentId: input.actorParentId, decidedAt: clock.now() })
      .where(and(eq(redemptions.id, redemption.id), eq(redemptions.status, "pending")))
      .returning({ id: redemptions.id });
    if (updated.length === 0) throw new DomainError("CONFLICT", ALREADY_DECIDED_MESSAGE);
    await notifyRejected(tx, { childId: redemption.childId, title: redemption.nameSnapshot, reason, refType: "redemption", refId: redemption.id });
  });
}
