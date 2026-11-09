import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { logSecurityEvent } from "../log";
import { clientIpFrom } from "./client-ip";
import { authenticateChild, authenticateDevice, authenticateParent, type ChildAuth, type DeviceAuth, type ParentAuth } from "./guards";
import type { SessionSubject } from "./sessions";

// Lớp mỏng cho Next.js: đọc cookie, gọi lõi guard, chuyển hướng khi chưa đăng nhập.
// Với Cache Components, mọi chỗ gọi các hàm này phải nằm trong <Suspense>.
// Server Action luôn gọi lại guard, không tin dữ liệu từ client.

export const COOKIE = { parent: "mc_parent", device: "mc_device", child: "mc_child" } as const satisfies Record<SessionSubject, string>;

export async function setSessionCookie(kind: SessionSubject, token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(COOKIE[kind], token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(kind: SessionSubject): Promise<void> {
  (await cookies()).delete(COOKIE[kind]);
}

export async function readCookie(kind: SessionSubject): Promise<string | undefined> {
  return (await cookies()).get(COOKIE[kind])?.value;
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  return clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

export async function getParentAuth(): Promise<ParentAuth | null> {
  return authenticateParent(getDb(), await readCookie("parent"));
}

/** Bố mẹ đã đăng nhập (có thể chưa có gia đình). */
export async function requireParent(): Promise<ParentAuth> {
  const auth = await getParentAuth();
  if (!auth) {
    if (await readCookie("child")) logSecurityEvent("authz_denied", { ip: await requestIp(), detail: "child_session_on_parent_route" });
    redirect("/login");
  }
  return auth;
}

/** Bố mẹ đã đăng nhập và đã thuộc một gia đình. */
export async function requireParentWithFamily(): Promise<ParentAuth & { familyId: number }> {
  const auth = await requireParent();
  if (auth.familyId === null) redirect("/onboarding");
  return auth as ParentAuth & { familyId: number };
}

export async function getDeviceAuth(): Promise<DeviceAuth | null> {
  return authenticateDevice(getDb(), await readCookie("device"));
}

export async function getChildAuth(): Promise<ChildAuth | null> {
  return authenticateChild(getDb(), await readCookie("device"), await readCookie("child"));
}

/** Con đã đăng nhập bằng PIN trên thiết bị gia đình. */
export async function requireChild(): Promise<ChildAuth> {
  const auth = await getChildAuth();
  if (!auth) redirect("/kid");
  return auth;
}
