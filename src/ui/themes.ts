// Nguồn duy nhất của token màu theme (design D6, docs/design/README.md §2).
// CSS cho [data-theme] được sinh từ đây; test tương phản (task 7.1) cũng đọc từ đây.

export const THEME_IDS = ["sunny", "ocean", "candy", "robot", "magic"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "sunny";
/** Giá trị form cho lựa chọn "Dùng theme của gia đình" ở màn con. */
export const FAMILY_THEME = "family";

export type ThemeTokens = {
  bg: string;
  card: string;
  soft: string;
  ring: string;
  primary: string;
  onPrimary: string;
  accent: string;
  ink: string;
  muted: string;
};

export const THEMES: Record<ThemeId, { name: string; hint?: string; mascot?: "robot" | "magic"; tokens: ThemeTokens }> = {
  sunny: {
    name: "Nắng mai",
    tokens: { bg: "#FFF6DF", card: "#FFFFFF", soft: "#FFE7A8", ring: "#FFC94D", primary: "#C2410C", onPrimary: "#FFFFFF", accent: "#F59E0B", ink: "#2B2118", muted: "#6B5644" },
  },
  ocean: {
    name: "Biển xanh",
    tokens: { bg: "#E6F5FA", card: "#FFFFFF", soft: "#C7ECF5", ring: "#7DD3E8", primary: "#0E7490", onPrimary: "#FFFFFF", accent: "#14B8A6", ink: "#0F2A33", muted: "#486570" },
  },
  candy: {
    name: "Kẹo ngọt",
    tokens: { bg: "#FDEEF6", card: "#FFFFFF", soft: "#F8D2E8", ring: "#F0A6D6", primary: "#A21CAF", onPrimary: "#FFFFFF", accent: "#EC4899", ink: "#2E1530", muted: "#6E4D6E" },
  },
  robot: {
    name: "Robot chiến binh",
    hint: "Gợi ý cho bé trai",
    mascot: "robot",
    tokens: { bg: "#EEF2F7", card: "#FFFFFF", soft: "#D6E0EE", ring: "#F5C518", primary: "#1D4ED8", onPrimary: "#FFFFFF", accent: "#E11D2E", ink: "#0F172A", muted: "#475569" },
  },
  magic: {
    name: "Phép thuật",
    hint: "Gợi ý cho bé gái",
    mascot: "magic",
    tokens: { bg: "#FFF3F8", card: "#FFFFFF", soft: "#FFD9E8", ring: "#F7C948", primary: "#BE185D", onPrimary: "#FFFFFF", accent: "#E9A400", ink: "#3A0F24", muted: "#7A3B5A" },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Theme hiệu lực = theme của con nếu có, ngược lại theme mặc định của gia đình (design D6). */
export function effectiveTheme(childTheme: string | null | undefined, familyTheme: string | null | undefined): ThemeId {
  if (isThemeId(childTheme)) return childTheme;
  if (isThemeId(familyTheme)) return familyTheme;
  return DEFAULT_THEME;
}

const CSS_VAR: Record<keyof ThemeTokens, string> = {
  bg: "--bg",
  card: "--card",
  soft: "--soft",
  ring: "--ring",
  primary: "--primary",
  onPrimary: "--on-primary",
  accent: "--accent",
  ink: "--ink",
  muted: "--muted",
};

function declarations(tokens: ThemeTokens): string {
  return (Object.keys(CSS_VAR) as (keyof ThemeTokens)[]).map((k) => `${CSS_VAR[k]}:${tokens[k]}`).join(";");
}

/** CSS cho mọi theme; `:root` dùng theme mặc định. */
export function themeCss(): string {
  const rules = THEME_IDS.map((id) => `[data-theme="${id}"]{${declarations(THEMES[id].tokens)}}`);
  return `:root{${declarations(THEMES[DEFAULT_THEME].tokens)}}${rules.join("")}`;
}
