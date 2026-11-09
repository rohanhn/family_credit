"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { enableFamilyMode, revokeDevice } from "@/server/auth/family-mode";
import { requireParentWithFamily, setSessionCookie } from "@/server/auth/next";
import { archiveChild, createChild, updateChild } from "@/server/domain/children";
import { updateCurrency } from "@/server/domain/currency";
import { createInvite } from "@/server/domain/families";
import { fromError, int, str, type ActionState } from "./result";

// Server Actions quản lý gia đình của bố mẹ (task 3.6). familyId luôn lấy từ phiên.

export async function createInviteAction(): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const { token, expiresAt } = await createInvite(getDb(), auth);
    const base = process.env.APP_URL?.replace(/\/$/, "") ?? "";
    return { ok: true, data: { url: `${base}/invite/${token}`, expiresAt: expiresAt.toISOString() } };
  } catch (err) {
    return fromError(err);
  }
}

export async function addChildAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const child = await createChild(getDb(), auth.familyId, { name: str(form, "name"), avatar: str(form, "avatar"), pin: str(form, "pin") });
    refresh();
    return { ok: true, message: `Đã thêm ${child.name}` };
  } catch (err) {
    return fromError(err);
  }
}

export async function updateChildAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const child = await updateChild(getDb(), auth.familyId, int(form, "childId"), {
      name: str(form, "name"),
      avatar: str(form, "avatar"),
      pin: str(form, "pin"),
    });
    refresh();
    return { ok: true, message: `Đã lưu hồ sơ của ${child.name}` };
  } catch (err) {
    return fromError(err);
  }
}

export async function archiveChildAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await archiveChild(getDb(), auth.familyId, int(form, "childId"));
    refresh();
    return { ok: true, message: "Đã lưu trữ hồ sơ. Lịch sử vẫn được giữ." };
  } catch (err) {
    return fromError(err);
  }
}

export async function updateCurrencyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const c = await updateCurrency(getDb(), auth.familyId, { name: str(form, "name"), icon: str(form, "icon") });
    refresh();
    return { ok: true, message: `Đơn vị tiền tệ giờ là "${c.name}"` };
  } catch (err) {
    return fromError(err);
  }
}

/** Bật chế độ gia đình trên thiết bị đang dùng rồi chuyển sang màn chọn avatar. */
export async function enableFamilyModeAction(): Promise<void> {
  const auth = await requireParentWithFamily();
  const session = await enableFamilyMode(getDb(), auth);
  await setSessionCookie("device", session.token, session.expiresAt);
  redirect("/kid");
}

export async function revokeDeviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await revokeDevice(getDb(), auth, str(form, "deviceId"));
    refresh();
    return { ok: true, message: "Đã thu hồi thiết bị" };
  } catch (err) {
    return fromError(err);
  }
}
