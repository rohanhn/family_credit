import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AVATAR_IDS } from "@/lib/avatars";
import { THEME_IDS, THEMES, type ThemeTokens } from "@/ui/themes";

// spec ui-theme "Bộ theme chibi" — Độ tương phản; danh sách cặp lấy từ docs/design/README.md §2.

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Màu `fg` phủ với độ đục `alpha` lên nền `bg` (như lớp Tailwind `bg-black/15`). */
function blend(fg: string, bg: string, alpha: number): string {
  const ch = (hex: string, shift: number) => (parseInt(hex.slice(1), 16) >> shift) & 255;
  const mix = (shift: number) => Math.round(alpha * ch(fg, shift) + (1 - alpha) * ch(bg, shift));
  return `#${((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, "0")}`;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Cặp chữ/nền được phép (chữ `primary` trên nền `soft` bị loại theo quy tắc ở README §2). */
const THEME_PAIRS: [text: keyof ThemeTokens, bg: keyof ThemeTokens][] = [
  ["ink", "bg"],
  ["ink", "soft"],
  ["muted", "bg"],
  ["muted", "card"],
  ["muted", "soft"],
  ["onPrimary", "primary"],
  ["primary", "card"],
  ["primary", "bg"],
];

/** Màu cố định, không đổi theo theme. */
const FIXED_PAIRS: [label: string, text: string, bg: string][] = [
  ["Hoàn thành", "#166534", "#DCF5E3"],
  ["Chờ duyệt", "#7A4A00", "#FFF1C2"],
  ["Chờ duyệt (đậm)", "#5C3A00", "#FFF1C2"],
  ["Nút + Thưởng", "#14532D", "#DCF5E3"],
  ["Nút − Phạt", "#8A1C1C", "#FDE2E1"],
  ["Điểm cộng trên trắng", "#15803D", "#FFFFFF"],
  ["Điểm trừ trên trắng", "#B91C1C", "#FFFFFF"],
];

describe("spec ui-theme: Độ tương phản", () => {
  it("Có ít nhất 3 theme", () => {
    expect(THEME_IDS.length).toBeGreaterThanOrEqual(3);
  });

  for (const id of THEME_IDS) {
    for (const [text, bg] of THEME_PAIRS) {
      it(`${id}: chữ ${text} trên nền ${bg} đạt 4.5:1`, () => {
        const t = THEMES[id].tokens;
        expect(contrast(t[text], t[bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const [label, text, bg] of FIXED_PAIRS) {
    it(`Màu cố định "${label}" đạt 4.5:1`, () => {
      expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }

  // Chữ đặt trên nền phủ alpha: tính trên màu nền sau khi phủ.
  for (const id of THEME_IDS) {
    const t = THEMES[id].tokens;
    it(`${id}: chữ trắng trên danh sách khoản của màn ăn mừng (primary phủ black/15) đạt 4.5:1`, () => {
      expect(contrast("#FFFFFF", blend("#000000", t.primary, 0.15))).toBeGreaterThanOrEqual(4.5);
    });
    it(`${id}: số điểm trong chuông trên dòng chưa đọc (card phủ soft/50) đạt 4.5:1`, () => {
      const unread = blend(t.soft, t.card, 0.5);
      expect(contrast("#166534", unread)).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#B91C1C", unread)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.muted, unread)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("primary trên soft vẫn đủ 3:1 cho icon và viền", () => {
    for (const id of THEME_IDS) expect(contrast(THEMES[id].tokens.primary, THEMES[id].tokens.soft)).toBeGreaterThanOrEqual(3);
  });

  it("Hàm tương phản khớp giá trị đo ở README (sunny primary/soft ≈ 4.25)", () => {
    expect(contrast(THEMES.sunny.tokens.primary, THEMES.sunny.tokens.soft)).toBeCloseTo(4.25, 1);
  });
});

describe("Tài nguyên SVG trong public/", () => {
  it("Mỗi avatar có file SVG", () => {
    for (const id of AVATAR_IDS) expect(existsSync(`public/avatars/${id}.svg`), id).toBe(true);
  });

  it("Mỗi theme có icon tiền tệ, theme có linh vật có file linh vật", () => {
    for (const id of THEME_IDS) {
      expect(existsSync(`public/themes/${id}/currency-star.svg`), id).toBe(true);
      if (THEMES[id].mascot) expect(existsSync(`public/themes/${id}/mascot.svg`), id).toBe(true);
    }
  });
});
