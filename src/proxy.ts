import { NextResponse, type NextRequest } from "next/server";
import { CHILD_MODE_COOKIE, COOKIE, SESSION_TTL_MS, SLIDING, sessionCookieOptions, type SessionSubject } from "./server/auth/session-cookies";

// Gia hạn cookie phiên trượt (bố mẹ, con) khi còn dùng, khớp với việc gia hạn `expires_at` trong DB
// (design D4). Hạn thật vẫn do DB quyết định; ở đây chỉ để trình duyệt không xóa cookie sớm hơn DB.
// Chỉ làm với GET: Server Action (POST) có thể xóa hoặc đặt cookie, ghi đè ở đây sẽ tranh chấp với nó.

// Cookie thiết bị cũng được đặt lại hạn: máy riêng có phiên thiết bị tự gia hạn trong DB, còn với máy
// dùng chung hạn thật vẫn do DB quyết định (cố định 90 ngày), nên đặt lại cookie không kéo dài gì.
const REFRESHED_SUBJECTS = [...(Object.keys(SLIDING) as SessionSubject[]).filter((k) => SLIDING[k]), "device" as const];

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.method !== "GET") return response;
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
