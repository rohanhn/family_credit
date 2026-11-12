"use client";

import { useActionState, useState } from "react";
import { cancelProposalAction, createProposalAction } from "@/app/actions/rules";
import type { ActionState } from "@/app/actions/result";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button, Card } from "@/ui/primitives";

type Kind = "reward" | "penalty";

/** Mục "Việc ngoài rule": hai nút mở cùng một form; đủ giới hạn thì thay bằng dòng nhắc (design D5). */
export function ProposalSection({ currencyName, atLimit, limit }: { currencyName: string; atLimit: boolean; limit: number }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [sent, setSent] = useState<string>();

  return (
    <section aria-label="Việc ngoài rule" className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-extrabold">Việc ngoài rule</h2>
      {sent && !kind && <FormMessage state={{ message: sent }} />}
      {kind ? (
        <ProposalForm
          key={kind}
          kind={kind}
          currencyName={currencyName}
          onSent={(message) => {
            setSent(message);
            setKind(null);
          }}
          onClose={() => setKind(null)}
        />
      ) : atLimit ? (
        <Card>
          <p className="text-sm font-bold text-muted">
            Con đang có {limit} đề xuất chờ bố mẹ duyệt. Chờ bố mẹ duyệt bớt hoặc hủy một đề xuất rồi gửi tiếp nhé.
          </p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2.5">
          <p className="text-sm font-bold text-muted">Con làm việc tốt hoặc mắc lỗi mà chưa có trong rule? Kể cho bố mẹ nhé.</p>
          <div className="flex flex-col gap-2">
            <Button variant="reward" className="min-h-12" onClick={() => setKind("reward")}>
              Con xin thưởng
            </Button>
            <Button variant="penalty" className="min-h-12" onClick={() => setKind("penalty")}>
              Con xin nhận phạt
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

function ProposalForm({
  kind,
  currencyName,
  onSent,
  onClose,
}: {
  kind: Kind;
  currencyName: string;
  onSent: (message: string) => void;
  onClose: () => void;
}) {
  // Ô nhập có state riêng để giữ nội dung con đã gõ khi server báo lỗi (form action tự xóa ô không điều khiển).
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("");
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await createProposalAction(prev, form);
    if (result?.ok) onSent(result.message ?? "Đã gửi cho bố mẹ duyệt");
    return result;
  }, undefined);
  const reward = kind === "reward";

  return (
    <Card>
      <form action={action} className="flex flex-col gap-2.5">
        <input type="hidden" name="kind" value={kind} />
        <Field
          label={reward ? "Con đã làm việc gì?" : "Con đã mắc lỗi gì?"}
          name="description"
          maxLength={200}
          placeholder={reward ? "Ví dụ: Giúp bà xách đồ" : "Ví dụ: Con làm vỡ cốc"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoFocus
        />
        <div className="max-w-36">
          <Field
            label={`${reward ? "Con xin bao nhiêu" : "Nên trừ bao nhiêu"} ${currencyName}?`}
            name="points"
            inputMode="numeric"
            placeholder="5"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <FormMessage state={state?.error ? state : undefined} />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton className="min-h-12">Gửi bố mẹ duyệt</SubmitButton>
          <Button variant="ghost" onClick={onClose}>
            Thôi
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function CancelProposalButton({ proposalId }: { proposalId: number }) {
  const [state, action] = useActionState(cancelProposalAction, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={proposalId} />
      <SubmitButton variant="ghost">Hủy</SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
