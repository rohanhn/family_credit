// Bộ avatar có sẵn (spec family-accounts "Quản lý hồ sơ con"). Dùng chung cho domain và UI.

export const AVATAR_LOOKS = {
  "boy-brown": { hair: "#3B2A20", buns: false },
  "girl-buns": { hair: "#6B3A1E", buns: true },
  "boy-black": { hair: "#1F1A17", buns: false },
  "girl-black": { hair: "#1F1A17", buns: true },
  "boy-ginger": { hair: "#9A4A1C", buns: false },
  "girl-brown": { hair: "#3B2A20", buns: true },
} as const;

export type AvatarId = keyof typeof AVATAR_LOOKS;
export const AVATAR_IDS = Object.keys(AVATAR_LOOKS) as AvatarId[];
export const DEFAULT_AVATAR: AvatarId = "boy-brown";

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && value in AVATAR_LOOKS;
}
