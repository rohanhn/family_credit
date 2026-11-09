import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react";

// Component dùng chung theo docs/design/README.md §4.

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "outline" | "soft" | "reward" | "penalty" | "ghost";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary shadow-press",
  outline: "border-2 border-black/15 bg-transparent text-ink",
  soft: "bg-soft text-ink",
  reward: "bg-reward-bg text-reward-on",
  penalty: "bg-penalty-bg text-penalty-on",
  ghost: "bg-transparent text-muted underline",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-[15px] rounded-[14px]",
  lg: "min-h-14 px-5 text-lg rounded-[18px]",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-extrabold transition-transform active:translate-y-px",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, cx("no-underline", className))} {...rest} />;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-3xl bg-card p-4 shadow-flat", className)} {...rest} />;
}

export type ChipTone = "soft" | "done" | "wait" | "primary";

const CHIP: Record<ChipTone, string> = {
  soft: "bg-soft text-ink",
  done: "bg-done-bg text-done-fg",
  wait: "bg-wait-bg text-wait-fg",
  primary: "bg-primary text-on-primary",
};

export function Chip({ tone = "soft", className, children }: { tone?: ChipTone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold", CHIP[tone], className)}>
      {children}
    </span>
  );
}

/** Thanh tiến độ: rãnh --soft, phần đầy --accent (README §4). */
export function ProgressBar({
  value,
  max,
  label,
  size = "md",
}: {
  value: number;
  max: number;
  label: string;
  size?: "sm" | "md";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cx("overflow-hidden rounded-full bg-soft", size === "md" ? "h-4" : "h-2.5")}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Đồng "Sao" (đơn vị mặc định). */
export function CoinIcon({ size = 28, face = true }: { size?: number; face?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8z"
        fill="var(--color-coin)"
        stroke="var(--color-coin-edge)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      {face && (
        <>
          <circle cx="10" cy="11.5" r=".9" fill="#5A3A00" />
          <circle cx="14" cy="11.5" r=".9" fill="#5A3A00" />
          <path d="M10.6 13.6q1.4 1 2.8 0" fill="none" stroke="#5A3A00" strokeWidth={0.8} strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
