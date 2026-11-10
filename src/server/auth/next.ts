import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
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

/**
 * Kiểm tra phiên luôn đọc giờ hiện tại (hạn phiên, gia hạn). `connection()` báo cho Next đây là phần
 * chỉ chạy lúc có request, để không lượt prerender nào (kể cả prefetch lúc chạy, khi cookie đã có
 * giá trị) chạm tới `Date.now()` (design D5 của change polish-after-mvp).
 */
async function sessionTokens<K extends SessionSubject>(...kinds: K[]): Promise<Record<K, string | undefined>> {
  const tokens = {} as Record<K, string | undefined>;
  for (const k of kinds) tokens[k] = await readCookie(k);
  await connection();
  return tokens;
}

export async function getParentAuth(): Promise<ParentAuth | null> {
  // Đọc cookie trước khi gọi getDb(): lúc prerender, cookies() dừng render trước khi chạm tới DB
  // (build Docker không có DATABASE_URL).
  const { parent } = await sessionTokens("parent");
  return authenticateParent(getDb(), parent);
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
  const { device } = await sessionTokens("device");
  return authenticateDevice(getDb(), device);
}

export async function getChildAuth(): Promise<ChildAuth | null> {
  const { device, child } = await sessionTokens("device", "child");
  return authenticateChild(getDb(), device, child);
}

/** Con đã đăng nhập bằng PIN trên thiết bị gia đình. */
export async function requireChild(): Promise<ChildAuth> {
  const auth = await getChildAuth();
  if (!auth) redirect("/kid");
  return auth;
}
