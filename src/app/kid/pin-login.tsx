"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { kidPinLoginAction } from "@/app/actions/kid";
import { ChibiAvatar } from "@/ui/chibi";
import { Icon } from "@/ui/icons";

type Kid = { id: number; name: string; avatar: string; locked: boolean };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/** Màn chọn avatar + bàn phím PIN (mockup KidLogin / WebKidLogin). Gõ bằng bàn phím máy tính cũng được. */
export function PinLogin({ kids }: { kids: Kid[] }) {
  const [state, action, pending] = useActionState(kidPinLoginAction, undefined);
  const [selected, setSelected] = useState<number | null>(kids.length === 1 ? kids[0].id : null);
  const [pin, setPin] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const kid = kids.find((k) => k.id === selected);

  // Gửi xong thì xóa các số đã nhập: sai PIN hoặc bị khóa thì con nhập lại từ đầu.
  const submit = (form: FormData) => {
    setPin("");
    action(form);
  };

  // Đủ 4 số thì tự gửi.
  useEffect(() => {
    if (pin.length === 4 && !pending) formRef.current?.requestSubmit();
  }, [pin, pending]);

  const press = (key: (typeof KEYS)[number]) => {
    if (key === "del") setPin((p) => p.slice(0, -1));
    else if (key !== "") setPin((p) => (p.length < 4 ? p + key : p));
    inputRef.current?.focus();
  };

  return (
    <div className="flex w-full max-w-[1000px] flex-wrap items-stretch gap-6">
      <section aria-label="Chọn con" className="grid flex-[999_1_460px] grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-center gap-4 rounded-[32px] bg-card p-5 shadow-flat md:p-7">
        {kids.map((k) => {
          const active = k.id === selected;
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelected(k.id);
                setPin("");
                inputRef.current?.focus();
              }}
              className={`flex flex-col items-center gap-2 rounded-[28px] border-4 px-2 py-4 ${active ? "border-primary bg-soft" : "border-transparent bg-bg"}`}
            >
              <ChibiAvatar avatar={k.avatar} size={96} />
              <span className="font-display text-2xl font-extrabold">{k.name}</span>
              {k.locked && (
                <span className="flex items-center gap-1 text-xs font-extrabold text-muted">
                  <Icon name="lock" size={14} /> Đang tạm khóa
                </span>
              )}
            </button>
          );
        })}
      </section>

      <section aria-label="Nhập mã PIN" className="flex flex-[1_1_300px] flex-col items-center gap-4 rounded-[32px] bg-card p-5 shadow-flat md:p-7">
        {kid ? (
          <>
            <p className="text-center text-lg font-extrabold">{kid.name} ơi, nhập mã bí mật nhé</p>
            <form ref={formRef} action={submit} className="flex flex-col items-center gap-3">
              <input type="hidden" name="childId" value={kid.id} />
              <label className="sr-only" htmlFor="pin">
                Mã PIN 4 số
              </label>
              <input
                ref={inputRef}
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="sr-only"
              />
              <div className="flex gap-4" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`size-[22px] rounded-full border-3 border-primary ${i < pin.length ? "bg-primary" : ""}`} />
                ))}
              </div>
              <p aria-live="polite" className="sr-only">
                Đã nhập {pin.length} trên 4 số
              </p>
            </form>
            <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
              {KEYS.map((key, i) =>
                key === "" ? (
                  <span key={i} />
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => press(key)}
                    disabled={pending}
                    aria-label={key === "del" ? "Xóa số vừa nhập" : `Số ${key}`}
                    className={`h-[60px] rounded-[18px] font-display text-[28px] font-extrabold ${key === "del" ? "bg-soft" : "bg-bg shadow-flat"}`}
                  >
                    {key === "del" ? "⌫" : key}
                  </button>
                ),
              )}
            </div>
            {state?.error ? (
              <p role="alert" className={`max-w-[280px] text-center text-base font-extrabold ${state.data?.locked ? "text-ink" : "text-minus"}`}>
                {state.error}
              </p>
            ) : (
              <p className="text-center text-sm font-bold text-muted">{pending ? "Đang mở…" : "Gõ bằng bàn phím máy tính cũng được"}</p>
            )}
          </>
        ) : (
          <p className="my-auto text-center text-lg font-extrabold text-muted">Con chọn avatar của mình nhé</p>
        )}
      </section>
    </div>
  );
}
