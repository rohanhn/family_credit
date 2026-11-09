"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { kidChangePinAction } from "@/app/actions/kid";
import { PinPad } from "@/ui/pin-pad";
import { buttonClass } from "@/ui/primitives";

const STEPS = [
  { key: "currentPin", title: "Nhập PIN hiện tại của con" },
  { key: "newPin", title: "Nhập PIN mới (4 số)" },
  { key: "confirmPin", title: "Nhập lại PIN mới" },
] as const;

/** Đổi PIN ba bước bằng bàn phím số: PIN hiện tại, PIN mới, nhập lại (spec "Con đổi PIN"). */
export function PinChange() {
  const [state, action, pending] = useActionState(kidChangePinAction, undefined);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<string[]>(["", "", ""]);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = values[step];

  const submit = (form: FormData) => {
    // Gửi xong làm lại từ đầu: sai thì con nhập lại cả ba bước, đúng thì màn báo đã đổi.
    setValues(["", "", ""]);
    setStep(0);
    action(form);
  };

  // Đủ 4 số thì sang bước sau.
  const change = (v: string) => {
    setValues((vs) => vs.map((x, i) => (i === step ? v : x)));
    if (v.length === 4 && step < STEPS.length - 1) setStep(step + 1);
  };

  // Bước cuối đủ 4 số thì gửi.
  useEffect(() => {
    if (step === STEPS.length - 1 && current.length === 4 && !pending) formRef.current?.requestSubmit();
  }, [current, step, pending]);

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[32px] bg-card p-6 text-center shadow-flat">
        <p role="status" className="text-lg font-extrabold">
          {state.message}
        </p>
        <Link href="/kid/home" className={buttonClass("primary", "lg")}>
          Về trang chính
        </Link>
      </div>
    );
  }

  return (
    <section aria-label="Đổi PIN" className="flex flex-col items-center gap-4 rounded-[32px] bg-card p-5 shadow-flat md:p-7">
      <p className="text-sm font-extrabold uppercase tracking-wide text-muted">
        Bước {step + 1}/{STEPS.length}
      </p>
      <p className="text-center text-lg font-extrabold">{STEPS[step].title}</p>
      <form ref={formRef} action={submit} className="flex w-full flex-col items-center gap-3">
        {STEPS.map((s, i) => (
          <input key={s.key} type="hidden" name={s.key} value={values[i]} />
        ))}
        <PinPad
          key={step}
          value={current}
          onChange={change}
          disabled={pending}
          label={STEPS[step].title}
          inputId="pin-change"
          inputRef={inputRef}
        />
      </form>
      {state?.error ? (
        <p role="alert" className={`max-w-[280px] text-center text-base font-extrabold ${state.data?.locked ? "text-ink" : "text-minus"}`}>
          {state.error}
        </p>
      ) : (
        <p className="text-center text-sm font-bold text-muted">{pending ? "Đang đổi…" : "Đừng cho ai biết PIN của con nhé"}</p>
      )}
      {step > 0 && (
        <button
          type="button"
          className="min-h-11 px-2 font-extrabold text-muted underline"
          onClick={() => {
            setValues(["", "", ""]);
            setStep(0);
          }}
        >
          Làm lại từ đầu
        </button>
      )}
    </section>
  );
}
