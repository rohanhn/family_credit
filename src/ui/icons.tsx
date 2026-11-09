import type { SVGProps } from "react";

// Icon SVG nét (stroke 2.2, đầu tròn), không dùng emoji (README §4).
// Mặc định aria-hidden; nút chỉ có icon phải có aria-label riêng.

const PATHS = {
  home: "M3 11l9-7 9 7M5 10v10h14V10",
  gift: "M3 9h18v12H3zM12 9v12M3 13h18M12 9C10 4 6 5 7.5 8c.6 1 4.5 1 4.5 1s3.9 0 4.5-1C18 5 14 4 12 9z",
  history: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  palette:
    "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 11h.01M10 7h.01M15 7.5h.01",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11",
  speaker: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  speakerOff: "M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6",
  check: "M5 12l5 5 9-10",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  phone: "M7 2h10v20H7zM11 18h2",
  goal: "M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5M5 21h14",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v5M12 16.5h.01",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  // Icon phần thưởng (REWARD_ICONS trong domain shop), theo mockup KidShop / WebKidShop.
  game: "M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5 2l-1.5-1.5h-5L8 17a3 3 0 0 1-5-2v-3a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3M16 12h.01M18 14h.01",
  icecream: "M8 10a4 4 0 1 1 8 0M7 10h10l-5 11zM9.5 14h5",
  park: "M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5M5 21h14",
  blocks: "M4 10h16v10H4zM7 10V7h4v3M13 10V7h4v3M4 15h16",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  movie: "M3 6h18v13H3zM3 10h18M7 6l2 4M12 6l2 4M17 6l2 4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
