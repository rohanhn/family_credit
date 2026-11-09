import { DAY, HOUR } from "../clock";

// Tên cookie, thời hạn và thuộc tính cookie phiên (design D4). Không phụ thuộc DB, nên dùng được cả
// trong `src/proxy.ts`.

export type SessionSubject = "parent" | "device" | "child";

export const COOKIE = { parent: "mc_parent", device: "mc_device", child: "mc_child" } as const satisfies Record<SessionSubject, string>;

export const SESSION_TTL_MS: Record<SessionSubject, number> = {
  parent: 30 * DAY,
  device: 90 * DAY,
  child: 2 * HOUR,
};

/**
 * Phiên con trên máy riêng: cookie chỉ sống trong phiên trình duyệt, còn DB giữ tối đa 30 ngày
 * (tự gia hạn) làm chốt chặn phía server (design D2 của change add-kid-personal-device).
 */
export const PERSONAL_CHILD_TTL_MS = 30 * DAY;

/**
 * Phiên bố mẹ và con được gia hạn khi còn dùng. Phiên thiết bị dùng chung có hạn cố định; phiên
 * thiết bị máy riêng cũng được gia hạn (xử lý trong `resolveSession` theo `device_child_id`).
 */
export const SLIDING: Record<SessionSubject, boolean> = { parent: true, device: false, child: true };

/**
 * Đánh dấu `mc_child` là cookie phiên trình duyệt (con đăng nhập trên máy riêng): proxy không đặt
 * hạn cho `mc_child`, để đóng hẳn trình duyệt thì cookie mất và con phải nhập lại PIN. Cookie này chỉ
 * quyết định việc gia hạn cookie; quyền vẫn do phiên trong DB quyết định.
 */
export const CHILD_MODE_COOKIE = "mc_child_mode";

/** `expires` bỏ trống: cookie phiên trình duyệt, mất khi đóng hẳn trình duyệt. */
export function sessionCookieOptions(expires?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expires ? { expires } : {}),
  };
}
