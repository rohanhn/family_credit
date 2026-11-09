import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { logSecurityEvent } from "../log";
import { clientIpFrom } from "./client-ip";
import { authenticateChild, authenticateDevice, authenticateParent, type ChildAuth, type DeviceAuth, type ParentAuth } from "./guards";
import { CHILD_MODE_COOKIE, COOKIE, sessionCookieOptions, type SessionSubject } from "./session-cookies";

// Lớp mỏng cho Next.js: đọc cookie, gọi lõi guard, chuyển hướng khi chưa đăng nhập.
// Với Cache Components, mọi chỗ gọi các hàm này phải nằm trong <Suspense>.
// Server Action luôn gọi lại guard, không tin dữ liệu từ client.

export { COOKIE };

export async function setSessionCookie(kind: SessionSubject, token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(COOKIE[kind], token, sessionCookieOptions(expiresAt));
}

/**
 * Cookie phiên con. Trên máy riêng (`browserSession`) cookie không có hạn, nên mất khi đóng hẳn
 * trình duyệt; kèm cookie đánh dấu để proxy không gia hạn nó (design D2).
 */
export async function setChildSessionCookie(token: string, expiresAt: Date, browserSession: boolean): Promise<void> {
  const jar = await cookies();
  if (browserSession) {
    jar.set(COOKIE.child, token, sessionCookieOptions());
    jar.set(CHILD_MODE_COOKIE, "browser", sessionCookieOptions());
  } else {
    jar.set(COOKIE.child, token, sessionCookieOptions(expiresAt));
    jar.delete(CHILD_MODE_COOKIE);
  }
}

export async function clearSessionCookie(kind: SessionSubject): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE[kind]);
  if (kind === "child") jar.delete(CHILD_MODE_COOKIE);
}

export async function readCookie(kind: SessionSubject): Promise<string | undefined> {
  return (await cookies()).get(COOKIE[kind])?.value;
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  return clientIpFrom(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

export async function getParentAuth(): Promise<ParentAuth | null> {
  // Đọc cookie trước khi gọi getDb(): lúc prerender, cookies() dừng render trước khi chạm tới DB
  // (build Docker không có DATABASE_URL).
  const token = await readCookie("parent");
  return authenticateParent(getDb(), token);
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
  const token = await readCookie("device");
  return authenticateDevice(getDb(), token);
}

export async function getChildAuth(): Promise<ChildAuth | null> {
  const [deviceToken, childToken] = [await readCookie("device"), await readCookie("child")];
  return authenticateChild(getDb(), deviceToken, childToken);
}

/** Con đã đăng nhập bằng PIN trên thiết bị gia đình. */
export async function requireChild(): Promise<ChildAuth> {
  const auth = await getChildAuth();
  if (!auth) redirect("/kid");
  return auth;
}
