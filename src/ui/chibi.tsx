// Hình chibi tự vẽ (docs/design/assets). Thiết kế gốc, không dùng nhân vật có bản quyền.

import { AVATAR_LOOKS, DEFAULT_AVATAR, isAvatarId } from "@/lib/avatars";

/** happy: mặc định; joy: màn ăn mừng (mắt cười, miệng mở); sad: màn báo bị trừ (lông mày cụp, giọt nước mắt). */
export function ChibiAvatar({ avatar, size = 56, mood = "happy" }: { avatar: string; size?: number; mood?: "happy" | "joy" | "sad" }) {
  const look = AVATAR_LOOKS[isAvatarId(avatar) ? avatar : DEFAULT_AVATAR];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {look.buns && (
        <>
          <circle cx="13" cy="20" r="7" fill={look.hair} />
          <circle cx="51" cy="20" r="7" fill={look.hair} />
        </>
      )}
      <circle cx="32" cy="34" r="22" fill="#FFE3C8" />
      <path d="M9 34C8 16 20 8 32 8s24 8 23 26c-3-8-9-12-15-12-3 4-9 6-14 6-6 0-11 2-17 6z" fill={look.hair} />
      {mood === "joy" ? (
        <>
          <path d="M20 38q4-5 8 0M36 38q4-5 8 0" fill="none" stroke="#2B2118" strokeWidth={2.2} strokeLinecap="round" />
          <ellipse cx="18" cy="45" rx="3.5" ry="2.2" fill="#FF8FA3" opacity=".7" />
          <ellipse cx="46" cy="45" rx="3.5" ry="2.2" fill="#FF8FA3" opacity=".7" />
          <path d="M26 44q6 7 12 0z" fill="#B3261E" />
        </>
      ) : (
        <>
          <ellipse cx="24" cy="38" rx="3.2" ry="4" fill="#2B2118" />
          <ellipse cx="40" cy="38" rx="3.2" ry="4" fill="#2B2118" />
          <circle cx="25.2" cy="36.5" r="1.1" fill="#fff" />
          <circle cx="41.2" cy="36.5" r="1.1" fill="#fff" />
          <ellipse cx="18" cy="45" rx="3.5" ry="2.2" fill="#FF8FA3" opacity=".55" />
          <ellipse cx="46" cy="45" rx="3.5" ry="2.2" fill="#FF8FA3" opacity=".55" />
          {mood === "happy" ? (
            <path d="M28.5 46q3.5 3 7 0" fill="none" stroke="#2B2118" strokeWidth={1.8} strokeLinecap="round" />
          ) : (
            <>
              <path d="M28 48q4-3 8 0" fill="none" stroke="#2B2118" strokeWidth={1.8} strokeLinecap="round" />
              <path d="M19 33l7-2M45 33l-7-2" stroke="#2B2118" strokeWidth={1.8} strokeLinecap="round" />
              <path d="M50 22q3 5 0 7-3-2 0-7z" fill="#7DD3FC" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

export function Mascot({ kind, size = 84, onDark = false }: { kind: "robot" | "magic"; size?: number; onDark?: boolean }) {
  if (kind === "robot") {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path d="M32 16V8" stroke="#1E3A8A" strokeWidth={3} strokeLinecap="round" />
        <circle cx="32" cy="7" r="4" fill="#F5C518" stroke="#1E3A8A" strokeWidth={2} />
        <rect x="6" y="28" width="6" height="12" rx="3" fill="#E11D2E" />
        <rect x="52" y="28" width="6" height="12" rx="3" fill="#E11D2E" />
        <rect x="12" y="16" width="40" height="34" rx="12" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth={3} />
        <rect x="18" y="25" width="28" height="15" rx="7" fill="#0F172A" />
        <circle cx="26" cy="32.5" r="3.5" fill="#5EEAD4" />
        <circle cx="38" cy="32.5" r="3.5" fill="#5EEAD4" />
        <path d="M27 45h10" stroke="#1E3A8A" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    );
  }
  const stroke = onDark ? "#FFFFFF" : "#9D174D";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M16 56L36 30" stroke={stroke} strokeWidth={4} strokeLinecap="round" />
      <path d="M40 14c-3-5-11-4-11 3 0 6 11 12 11 12s11-6 11-12c0-7-8-8-11-3z" fill={onDark ? "#F9A8D4" : "#F472B6"} stroke={stroke} strokeWidth={2} />
      <path d="M58 44a8 8 0 1 1-7-13 6.5 6.5 0 0 0 7 13z" fill="#F7C948" />
      <path d="M14 14l1.5 3.5L19 19l-3.5 1.5L14 24l-1.5-3.5L9 19l3.5-1.5z" fill="#F7C948" />
      <path d="M52 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill={onDark ? "#FFFFFF" : "#F7C948"} />
    </svg>
  );
}
