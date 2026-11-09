"use client";

import { useState, type ReactNode } from "react";
import { Mascot } from "./chibi";
import { FAMILY_THEME, THEMES, type ThemeId } from "./themes";

// Chọn theme có ảnh xem trước (mockup KidTheme). Dùng radio thật nên chọn được bằng bàn phím.
// Giá trị "family" là "Dùng theme của gia đình" (chỉ có ở màn con).

/** Ảnh xem trước thu nhỏ: đặt data-theme nên các lớp màu Tailwind lấy đúng token của theme đó. */
export function ThemePreview({ id }: { id: ThemeId }) {
  const mascot = THEMES[id].mascot;
  return (
    <div data-theme={id} className="relative flex h-[92px] flex-col gap-1.5 overflow-hidden rounded-[14px] bg-bg p-2" aria-hidden="true">
      <div className="h-[30px] w-[70%] rounded-[10px] bg-primary" />
      <div className="h-2 w-[80%] overflow-hidden rounded-full bg-soft">
        <div className="h-full w-[60%] bg-accent" />
      </div>
      <div className="h-4 w-[55%] rounded-md bg-card" />
      {mascot && (
        <span className="absolute bottom-1 right-1">
          <Mascot kind={mascot} size={46} />
        </span>
      )}
    </div>
  );
}

/** Thứ tự như mockup KidTheme; luôn chứa đủ THEME_IDS. */
const ORDER: readonly ThemeId[] = ["robot", "magic", "sunny", "ocean", "candy"] satisfies ThemeId[];

export function ThemePicker({
  name = "theme",
  defaultValue,
  familyTheme,
  onChange,
  children,
}: {
  name?: string;
  /** Theme đang chọn, hoặc FAMILY_THEME. */
  defaultValue: string;
  /** Có thì hiện lựa chọn "Dùng theme của gia đình" kèm tên theme hiện tại của gia đình. */
  familyTheme?: ThemeId;
  onChange?: (value: string) => void;
  children?: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const pick = (v: string) => {
    setValue(v);
    onChange?.(v);
  };
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Chọn giao diện</legend>
      {familyTheme && (
        <label className="group cursor-pointer">
          <input type="radio" name={name} value={FAMILY_THEME} checked={value === FAMILY_THEME} onChange={() => pick(FAMILY_THEME)} className="peer sr-only" />
          <span className="flex min-h-[52px] items-center gap-2.5 rounded-2xl border-3 border-transparent bg-card px-3.5 py-2 peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
            <span className="size-5 shrink-0 rounded-full border-3 border-primary group-has-checked:bg-primary" />
            <span className="flex flex-col">
              <span className="text-[15px] font-extrabold">Dùng theme của gia đình</span>
              <span className="text-xs font-bold text-muted">Hiện tại: {THEMES[familyTheme].name}</span>
            </span>
          </span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER.map((id) => (
          <label key={id} className="cursor-pointer">
            <input type="radio" name={name} value={id} checked={value === id} onChange={() => pick(id)} className="peer sr-only" />
            <span className="flex h-full flex-col gap-1.5 rounded-[20px] border-3 border-transparent bg-card p-2 peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
              <ThemePreview id={id} />
              <span className="px-1 text-[15px] font-extrabold">{THEMES[id].name}</span>
              {THEMES[id].hint && <span className="px-1 text-xs font-bold text-muted">{THEMES[id].hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}
