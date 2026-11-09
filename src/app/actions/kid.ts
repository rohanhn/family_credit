"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { loginChildWithPin, logoutChild } from "@/server/auth/family-mode";
import { clearSessionCookie, getDeviceAuth, readCookie, requireChild, setSessionCookie } from "@/server/auth/next";
import { DomainError } from "@/server/domain/errors";
import { setChildTheme } from "@/server/domain/themes";
import { FAMILY_THEME } from "@/ui/themes";
import { fromError, int, str, type ActionState } from "./result";

// Server Actions phía con (task 3.6): đăng nhập PIN trên thiết bị gia đình và thoát.

export async function kidPinLoginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const device = await getDeviceAuth();
  if (!device) return { error: "Thiết bị này chưa bật chế độ gia đình" };
  try {
    const session = await loginChildWithPin(getDb(), { familyId: device.familyId, childId: int(form, "childId"), pin: str(form, "pin") });
    await setSessionCookie("child", session.token, session.expiresAt);
  } catch (err) {
    if (err instanceof DomainError && err.code === "LOCKED") return { error: err.message, data: { locked: "1" } };
    return fromError(err);
  }
  redirect("/kid/home");
}

export async function kidLogoutAction(): Promise<void> {
  await logoutChild(getDb(), await readCookie("child"));
  await clearSessionCookie("child");
  redirect("/kid");
}

/** Con chọn theme cho màn của mình, hoặc "Dùng theme của gia đình" (spec ui-theme "Con tự chọn theme"). */
export async function kidSetThemeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    const value = str(form, "theme");
    await setChildTheme(getDb(), kid.familyId, kid.childId, value === FAMILY_THEME ? null : value);
    refresh();
    return { ok: true, message: "Đã đổi giao diện" };
  } catch (err) {
    return fromError(err);
  }
}
