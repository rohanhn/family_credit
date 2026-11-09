"use client";

import type { RefObject } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/**
 * Ô nhập PIN 4 số: chấm tròn, ô input ẩn (gõ bằng bàn phím máy tính cũng được) và bàn phím số 60px.
 * Dùng chung cho màn đăng nhập PIN và màn đổi PIN.
 */
export function PinPad({
  value,
  onChange,
  disabled,
  label,
  inputId,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Nhãn đọc màn hình của ô input. */
  label: string;
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === "del") onChange(value.slice(0, -1));
    else if (key !== "" && value.length < 4) onChange(value + key);
    inputRef.current?.focus();
  };
  return (
    <>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="sr-only"
      />
      <div className="flex gap-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`size-[22px] rounded-full border-3 border-primary ${i < value.length ? "bg-primary" : ""}`} />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        Đã nhập {value.length} trên 4 số
      </p>
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              disabled={disabled}
              aria-label={key === "del" ? "Xóa số vừa nhập" : `Số ${key}`}
              className={`h-[60px] rounded-[18px] font-display text-[28px] font-extrabold ${key === "del" ? "bg-soft" : "bg-bg shadow-flat"}`}
            >
              {key === "del" ? "⌫" : key}
            </button>
          ),
        )}
      </div>
    </>
  );
}
