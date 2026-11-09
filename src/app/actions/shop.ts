"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db/client";
import { requireChild, requireParentWithFamily } from "@/server/auth/next";
import {
  approveRedemption,
  cancelRedemption,
  createRedemption,
  createReward,
  rejectRedemption,
  setGoal,
  setRewardHidden,
  updateReward,
} from "@/server/domain/shop";
import { signed } from "@/lib/time";
import { fromError, int, str, type ActionState } from "./result";

// Server Actions cho cửa hàng đổi thưởng (task 6.2).

// ---- Phía bố mẹ ----

function rewardFields(form: FormData) {
  return { name: str(form, "name"), price: int(form, "price"), icon: str(form, "icon"), description: str(form, "description") };
}

export async function createRewardAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const reward = await createReward(getDb(), auth.familyId, rewardFields(form));
    refresh();
    return { ok: true, message: `Đã thêm "${reward.name}"` };
  } catch (err) {
    return fromError(err);
  }
}

export async function updateRewardAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const reward = await updateReward(getDb(), auth.familyId, int(form, "rewardId"), rewardFields(form));
    refresh();
    return { ok: true, message: `Đã lưu "${reward.name}". Yêu cầu đã gửi giữ giá cũ.` };
  } catch (err) {
    return fromError(err);
  }
}

export async function toggleRewardHiddenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const reward = await setRewardHidden(getDb(), auth.familyId, int(form, "rewardId"), str(form, "hidden") === "1");
    refresh();
    return { ok: true, message: reward.hidden ? `Đã ẩn "${reward.name}"` : `Đã hiện lại "${reward.name}"` };
  } catch (err) {
    return fromError(err);
  }
}

export async function approveRedemptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const txn = await approveRedemption(getDb(), { familyId: auth.familyId, actorParentId: auth.parentId, redemptionId: int(form, "id") });
    refresh();
    return { ok: true, message: `Đã duyệt ${signed(txn.appliedAmount)}`, data: { applied: String(txn.appliedAmount) } };
  } catch (err) {
    return fromError(err);
  }
}

export async function rejectRedemptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await rejectRedemption(getDb(), { familyId: auth.familyId, actorParentId: auth.parentId, redemptionId: int(form, "id"), reason: str(form, "reason") });
    refresh();
    return { ok: true, message: "Đã từ chối" };
  } catch (err) {
    return fromError(err);
  }
}

// ---- Phía con ----

export async function redeemAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    const req = await createRedemption(getDb(), { familyId: kid.familyId, childId: kid.childId, rewardId: int(form, "rewardId") });
    refresh();
    return { ok: true, message: `Đã gửi "${req.nameSnapshot}" cho bố mẹ duyệt` };
  } catch (err) {
    return fromError(err);
  }
}

export async function cancelRedemptionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    await cancelRedemption(getDb(), { childId: kid.childId, redemptionId: int(form, "id") });
    refresh();
    return { ok: true, message: "Đã hủy yêu cầu" };
  } catch (err) {
    return fromError(err);
  }
}

/** Chọn mục tiêu; rewardId rỗng là bỏ mục tiêu. */
export async function setGoalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    const raw = str(form, "rewardId");
    await setGoal(getDb(), { familyId: kid.familyId, childId: kid.childId, rewardId: raw ? int(form, "rewardId") : null });
    refresh();
    return { ok: true, message: raw ? "Đã chọn mục tiêu" : "Đã bỏ mục tiêu" };
  } catch (err) {
    return fromError(err);
  }
}
