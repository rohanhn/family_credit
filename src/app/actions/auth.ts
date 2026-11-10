"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { changePassword, loginParent, logoutParent, registerParent } from "@/server/auth/parent-auth";
import { clearSessionCookie, readCookie, requestIp, requireParent, setSessionCookie } from "@/server/auth/next";
import { acceptInvite, createFamily } from "@/server/domain/families";
import { fromError, str, type ActionState } from "./result";

// Server Actions xác thực bố mẹ (task 3.6). Mỗi action tự xác thực lại, không tin dữ liệu từ client.

/** Chỉ cho phép quay lại trang nhận lời mời sau khi đăng nhập/đăng ký. */
function safeNext(next: string): string | null {
  return /^\/invite\/[A-Za-z0-9_-]{20,100}$/.test(next) ? next : null;
}

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const r = await registerParent(
      getDb(),
      { email: str(form, "email"), password: str(form, "password"), displayName: str(form, "displayName") },
      { ip: await requestIp(), deviceToken: await readCookie("device") },
    );
    await setSessionCookie("parent", r.token, r.expiresAt);
  } catch (err) {
    return fromError(err);
  }
  redirect(safeNext(str(form, "next")) ?? "/onboarding");
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const r = await loginParent(getDb(), { email: str(form, "email"), password: str(form, "password") }, { ip: await requestIp(), deviceToken: await readCookie("device") });
    await setSessionCookie("parent", r.token, r.expiresAt);
  } catch (err) {
    return fromError(err);
  }
  redirect(safeNext(str(form, "next")) ?? "/parent");
}

export async function logoutAction(): Promise<void> {
  await logoutParent(getDb(), await readCookie("parent"));
  await clearSessionCookie("parent");
  redirect("/login");
}

export async function createFamilyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParent();
  try {
    await createFamily(getDb(), auth.parentId, { name: str(form, "name") });
  } catch (err) {
    return fromError(err);
  }
  redirect("/parent");
}

export async function acceptInviteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParent();
  try {
    await acceptInvite(getDb(), auth.parentId, str(form, "token"));
  } catch (err) {
    return fromError(err);
  }
  redirect("/parent");
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParent();
  if (str(form, "newPassword") !== str(form, "confirmPassword")) return { error: "Hai lần nhập mật khẩu mới không khớp" };
  try {
    const r = await changePassword(
      getDb(),
      {
        parentId: auth.parentId,
        currentSessionIdHash: auth.sessionIdHash,
        currentPassword: str(form, "currentPassword"),
        newPassword: str(form, "newPassword"),
      },
      { ip: await requestIp() },
    );
    return { ok: true, message: r.revokedSessions > 0 ? `Đã đổi mật khẩu và đăng xuất ${r.revokedSessions} thiết bị khác` : "Đã đổi mật khẩu" };
  } catch (err) {
    return fromError(err);
  }
}
