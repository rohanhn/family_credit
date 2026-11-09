"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { kidPinLoginAction } from "@/app/actions/kid";
import { ChibiAvatar } from "@/ui/chibi";
import { Icon } from "@/ui/icons";
import { PinPad } from "@/ui/pin-pad";

type Kid = { id: number; name: string; avatar: string; locked: boolean };

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
            <form ref={formRef} action={submit} className="flex w-full flex-col items-center gap-3">
              <input type="hidden" name="childId" value={kid.id} />
              <input type="hidden" name="pin" value={pin} />
              <PinPad value={pin} onChange={setPin} disabled={pending} label="Mã PIN 4 số" inputId="pin" inputRef={inputRef} />
            </form>
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
