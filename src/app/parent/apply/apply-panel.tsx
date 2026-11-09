"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { applyAction } from "@/app/actions/rules";
import { signed } from "@/lib/time";
import { ChibiAvatar } from "@/ui/chibi";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Icon } from "@/ui/icons";
import { Card } from "@/ui/primitives";
import { useSound } from "@/ui/sound";

type Kid = { id: number; name: string; avatar: string; balance: number };
type Rule = { id: number; name: string; kind: "reward" | "penalty"; points: number };

const step = "text-[13px] font-extrabold uppercase tracking-wide text-muted";

/** Thưởng / Phạt (mockup ParentApplyRule / WebParentApply). */
export function ApplyPanel({
  kids,
  rules,
  currency,
  initialChildId,
  initialKind,
}: {
  kids: Kid[];
  rules: Rule[];
  currency: string;
  initialChildId: number | null;
  initialKind: "reward" | "penalty";
}) {
  const [state, action] = useActionState(applyAction, undefined);
  const { play } = useSound();
  // Âm phát sau khi Server Action ghi giao dịch thành công (design D6); xác nhận bằng chữ ở FormMessage.
  const recorded = state?.ok ? state.data?.nonce : undefined;
  const recordedSign = Number(state?.data?.requested ?? 0);
  useEffect(() => {
    if (recorded) play(recordedSign > 0 ? "reward" : "penalty");
  }, [recorded, recordedSign, play]);
  const [childId, setChildId] = useState<number>(initialChildId ?? kids[0]?.id);
  const [kind, setKind] = useState<"reward" | "penalty">(initialKind);
  const [choice, setChoice] = useState<string>("");
  const [adhocPoints, setAdhocPoints] = useState("");

  const kid = kids.find((k) => k.id === childId) ?? kids[0];
  const kindRules = rules.filter((r) => r.kind === kind);
  const rule = kindRules.find((r) => String(r.id) === choice);
  const isAdhoc = choice === "adhoc";
  const points = isAdhoc ? Number(adhocPoints) || 0 : (rule?.points ?? 0);
  const isReward = kind === "reward";
  const applied = isReward ? points : Math.min(points, kid?.balance ?? 0);
  const capped = !isReward && points > (kid?.balance ?? 0);
  const after = (kid?.balance ?? 0) + (isReward ? applied : -applied);
  const ready = !!kid && points > 0 && (isAdhoc || !!rule);

  const pickKind = (k: "reward" | "penalty") => {
    setKind(k);
    setChoice("");
  };

  if (!kid) {
    return (
      <Card>
        <p className="font-semibold text-muted">
          Chưa có hồ sơ con. <Link href="/parent/settings#con" className="text-primary underline">Thêm con</Link>
        </p>
      </Card>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-start gap-6">
      <input type="hidden" name="childId" value={kid.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="choice" value={choice} />

      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold">Thưởng / Phạt</h1>
          <Link href="/parent/rules" className="font-extrabold text-primary underline">
            Quản lý danh mục rule
          </Link>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className={step}>1. Chọn con</legend>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
            {kids.map((k) => (
              <label key={k.id} className="cursor-pointer">
                <input type="radio" name="_child" className="peer sr-only" checked={k.id === kid.id} onChange={() => setChildId(k.id)} />
                <span className="flex min-h-16 items-center gap-2.5 rounded-[18px] border-3 border-transparent bg-card px-3 py-2 shadow-flat peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
                  <ChibiAvatar avatar={k.avatar} size={40} />
                  <span className="flex flex-col">
                    <span className="font-extrabold">{k.name}</span>
                    <span className="text-xs font-bold text-muted">
                      {k.balance} {currency}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={step}>2. Thưởng hay phạt</legend>
          <div className="mt-2 grid max-w-[420px] grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
            {(["reward", "penalty"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
                className={`min-h-11 rounded-xl text-base font-extrabold ${kind === k ? (k === "reward" ? "bg-card text-plus" : "bg-card text-minus") : "text-muted"}`}
              >
                {k === "reward" ? "+ Thưởng" : "− Phạt"}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className={step}>3. Chọn rule</legend>
          <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
            {kindRules.map((r) => (
              <label key={r.id} className="cursor-pointer">
                <input type="radio" name="_rule" className="peer sr-only" checked={choice === String(r.id)} onChange={() => setChoice(String(r.id))} />
                <span className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] border-3 border-transparent bg-card px-4 shadow-flat peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
                  <span className="flex-1 font-extrabold">{r.name}</span>
                  <span className={`font-display text-xl font-extrabold ${isReward ? "text-plus" : "text-minus"}`}>{signed(isReward ? r.points : -r.points)}</span>
                </span>
              </label>
            ))}
            <label className="cursor-pointer">
              <input type="radio" name="_rule" className="peer sr-only" checked={isAdhoc} onChange={() => setChoice("adhoc")} />
              <span className="flex min-h-[60px] items-center rounded-[18px] border-3 border-dashed border-black/20 px-4 font-extrabold peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
                Đột xuất (ngoài rule)
              </span>
            </label>
          </div>
          {kindRules.length === 0 && (
            <p className="text-sm font-semibold text-muted">
              Chưa có rule {isReward ? "thưởng" : "phạt"} nào. Dùng “Đột xuất” hoặc thêm rule trong danh mục.
            </p>
          )}
        </fieldset>
      </section>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 rounded-[28px] bg-card p-5 shadow-flat">
        <h2 className="font-display text-[22px] font-extrabold">Xem trước</h2>
        <div className="flex items-center justify-between gap-2 rounded-[18px] bg-bg p-3.5" aria-live="polite">
          <span className="flex flex-col">
            <span className="text-xs font-bold text-muted">{kid.name} đang có</span>
            <span className="font-display text-[28px] font-extrabold">{kid.balance}</span>
          </span>
          <Icon name="back" className="rotate-180 text-muted" />
          <span className="flex flex-col items-end">
            <span className="text-xs font-bold text-muted">Sau khi ghi</span>
            <span className={`font-display text-[28px] font-extrabold ${isReward ? "text-plus" : "text-minus"}`}>{ready ? after : "—"}</span>
          </span>
        </div>

        {isAdhoc ? (
          <div className="flex gap-2">
            <div className="w-24">
              <Field label="Số điểm" name="points" type="number" min={1} step={1} inputMode="numeric" value={adhocPoints} onChange={(e) => setAdhocPoints(e.target.value)} required />
            </div>
            <div className="flex-1">
              <Field label="Lý do (bắt buộc)" name="reason" placeholder="VD: Giúp bà dọn nhà" maxLength={200} required />
            </div>
          </div>
        ) : (
          <Field label="Ghi chú (không bắt buộc)" name="note" placeholder="VD: lúc ăn tối" maxLength={100} />
        )}

        {ready && capped && (
          <p className="flex items-start gap-2 rounded-[14px] bg-wait-bg px-3 py-2.5 text-sm font-bold text-wait-fg">
            <Icon name="info" size={18} className="mt-px shrink-0" />
            {kid.name} chỉ còn {kid.balance} {currency}, nên chỉ trừ được {kid.balance}. Lịch sử vẫn ghi mức phạt gốc {signed(-points)}.
          </p>
        )}

        <FormMessage state={state} />
        <SubmitButton size="lg" variant={isReward ? "reward" : "penalty"} className="!text-lg">
          {ready ? `${isReward ? "Thưởng" : "Phạt"} ${kid.name} ${signed(isReward ? applied : -applied)} ${currency}` : "Chọn rule hoặc đột xuất"}
        </SubmitButton>
        <p className="text-xs font-semibold text-muted">Ghi nhầm? Vào Lịch sử để tạo giao dịch điều chỉnh, giao dịch cũ không bị xóa.</p>
      </aside>
    </form>
  );
}
