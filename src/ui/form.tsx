"use client";

import { useFormStatus } from "react-dom";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "./primitives";
import { Icon } from "./icons";

// Thành phần form dùng chung: nhãn thật gắn với ô nhập, thông báo lỗi đọc được bằng trình đọc màn hình.

export function Field({ label, hint, id, ...input }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1 text-[13px] font-extrabold text-muted">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className="min-h-11 w-full rounded-xl border-2 border-black/15 bg-card px-3 text-base font-bold text-ink placeholder:font-normal placeholder:text-muted/70 focus:border-primary focus:outline-none"
        {...input}
      />
      {hint && (
        <span id={hintId} className="text-xs font-semibold">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText = "Đang xử lý…",
  variant,
  size,
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending} variant={variant} size={size} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; message?: string } }) {
  if (!state?.error && !state?.message) return null;
  if (state.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-[14px] bg-penalty-bg px-3 py-2.5 text-sm font-bold text-penalty-on">
        <Icon name="info" size={18} className="mt-px shrink-0" />
        {state.error}
      </p>
    );
  }
  return (
    <p role="status" className="flex items-start gap-2 rounded-[14px] bg-done-bg px-3 py-2.5 text-sm font-bold text-done-fg">
      <Icon name="check" size={18} className="mt-px shrink-0" />
      {state.message}
    </p>
  );
}
