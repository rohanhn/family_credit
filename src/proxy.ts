import { NextResponse, type NextRequest } from "next/server";
import { CHILD_MODE_COOKIE, COOKIE, SESSION_TTL_MS, SLIDING, sessionCookieOptions, type SessionSubject } from "./server/auth/session-cookies";

// Gia hạn cookie phiên trượt (bố mẹ, con) khi còn dùng, khớp với việc gia hạn `expires_at` trong DB
// (design D4). Hạn thật vẫn do DB quyết định; ở đây chỉ để trình duyệt không xóa cookie sớm hơn DB.
// Chỉ làm với GET: Server Action (POST) có thể xóa hoặc đặt cookie, ghi đè ở đây sẽ tranh chấp với nó.
// Cũng chỉ làm ở request tải trang, không làm với request RSC và prefetch của client router: những
// request này có thể xuất phát trước một Server Action xóa cookie (bật chế độ gia đình) nhưng trả về
// sau, rồi ghi lại cookie vừa bị xóa (design D6 của change polish-after-mvp).

// Cookie thiết bị cũng được đặt lại hạn: máy riêng có phiên thiết bị tự gia hạn trong DB, còn với máy
// dùng chung hạn thật vẫn do DB quyết định (cố định 90 ngày), nên đặt lại cookie không kéo dài gì.
const REFRESHED_SUBJECTS = [...(Object.keys(SLIDING) as SessionSubject[]).filter((k) => SLIDING[k]), "device" as const];

/**
 * Lối vào ở trang gốc (spec "Lối vào ứng dụng", design D5): chỉ dựa vào cookie có mặt, không đọc DB.
 * Cookie đã hết hiệu lực thì guard ở trang đích chuyển tiếp (`/kid/home` → `/kid` → …).
 */
export function entryPath(request: NextRequest): string {
  if (request.cookies.has(COOKIE.child)) return "/kid/home";
  if (request.cookies.has(COOKIE.device)) return "/kid";
  if (request.cookies.has(COOKIE.parent)) return "/parent";
  return "/login";
}

/**
 * Request chạy ngầm bằng `fetch()` (request RSC khi điều hướng phía client, prefetch), không phải lần tải
 * trang. Next gỡ header `RSC`, `Next-Router-Prefetch` và tham số `_rsc` trước khi gọi proxy, nên dựa vào
 * `Sec-Fetch-Mode` của trình duyệt: tải trang là `navigate`. Trình duyệt không gửi header này thì coi
 * như tải trang (giữ hành vi cũ).
 */
export function isBackgroundRequest(request: NextRequest): boolean {
  const mode = request.headers.get("sec-fetch-mode");
  return mode !== null && mode !== "navigate";
}

export function proxy(request: NextRequest) {
  if (request.method === "GET" && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(entryPath(request), request.url));
  }
  const response = NextResponse.next();
  if (request.method !== "GET" || isBackgroundRequest(request)) return response;
  const now = Date.now();
  const browserChild = request.cookies.has(CHILD_MODE_COOKIE);
  for (const subject of REFRESHED_SUBJECTS) {
    // Con trên máy riêng: cookie phiên trình duyệt, không đặt hạn (design D2).
    if (subject === "child" && browserChild) continue;
    const value = request.cookies.get(COOKIE[subject])?.value;
    if (value) response.cookies.set(COOKIE[subject], value, sessionCookieOptions(new Date(now + SESSION_TTL_MS[subject])));
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|avatars|themes|.*\\.(?:svg|png|ico|txt|webmanifest)$).*)"],
};
