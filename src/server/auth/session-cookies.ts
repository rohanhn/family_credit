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

/** Phiên bố mẹ và con được gia hạn khi còn dùng; phiên thiết bị có hạn cố định. */
export const SLIDING: Record<SessionSubject, boolean> = { parent: true, device: false, child: true };

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}
