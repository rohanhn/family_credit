// Bộ icon có sẵn cho phần thưởng (design D3 "Đổi thưởng"); dùng chung cho domain và UI client.

export const REWARD_ICONS = ["gift", "game", "icecream", "park", "blocks", "book", "movie"] as const;
export type RewardIcon = (typeof REWARD_ICONS)[number];
export const DEFAULT_REWARD_ICON: RewardIcon = "gift";

/** Icon hợp lệ để hiển thị; giá trị lạ (dữ liệu cũ) quay về icon mặc định. */
export function rewardIcon(icon: string): RewardIcon {
  return (REWARD_ICONS as readonly string[]).includes(icon) ? (icon as RewardIcon) : DEFAULT_REWARD_ICON;
}
