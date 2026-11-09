import type { CurrencyIcon as CurrencyIconId } from "@/server/domain/currency";
import { CoinIcon } from "./primitives";

// Icon đơn vị tiền tệ của gia đình (spec currency-ledger "Đơn vị tiền tệ của gia đình").
// Dùng màu đồng "Sao" cố định (README §2) nên đọc được trên nền primary lẫn nền thẻ.

const FILL = "var(--color-coin)";
const EDGE = "var(--color-coin-edge)";

export function CurrencyIcon({ icon, size = 28 }: { icon: CurrencyIconId | string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, focusable: false } as const;
  switch (icon) {
    case "coin":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill={FILL} stroke={EDGE} strokeWidth={1} />
          <circle cx="12" cy="12" r="6.5" fill="none" stroke={EDGE} strokeWidth={1} opacity={0.6} />
          <path d="M12 8.5v7M10 10.5h3a1.5 1.5 0 0 1 0 3h-2" fill="none" stroke={EDGE} strokeWidth={1.2} strokeLinecap="round" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" fill={FILL} stroke={EDGE} strokeWidth={1} />
          <path d="M12 7v5l3.5 2" fill="none" stroke={EDGE} strokeWidth={1.6} strokeLinecap="round" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z" fill="#FF8FB1" stroke="#9D174D" strokeWidth={1} strokeLinejoin="round" />
        </svg>
      );
    case "gem":
      return (
        <svg {...common}>
          <path d="M6 4h12l4 5-10 11L2 9z" fill="#7DD3E8" stroke="#0E5A70" strokeWidth={1} strokeLinejoin="round" />
          <path d="M2 9h20M9 4l3 16 3-16" fill="none" stroke="#0E5A70" strokeWidth={0.8} opacity={0.7} />
        </svg>
      );
    case "game":
      return (
        <svg {...common}>
          <path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.3 1.9L15 14H9l-1.7 1.9A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z" fill={FILL} stroke={EDGE} strokeWidth={1} strokeLinejoin="round" />
          <path d="M7 10v3M5.5 11.5h3" stroke={EDGE} strokeWidth={1.3} strokeLinecap="round" />
          <circle cx="16" cy="11" r="1" fill={EDGE} />
          <circle cx="18" cy="13" r="1" fill={EDGE} />
        </svg>
      );
    default:
      return <CoinIcon size={size} />;
  }
}
