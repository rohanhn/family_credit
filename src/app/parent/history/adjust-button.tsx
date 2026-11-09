"use client";

import { useActionState, useState } from "react";
import { adjustTransactionAction } from "@/app/actions/rules";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button } from "@/ui/primitives";

/** Hoàn tác một giao dịch bằng giao dịch điều chỉnh kèm lý do (giao dịch gốc không bị xóa). */
export function AdjustButton({ transactionId }: { transactionId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(adjustTransactionAction, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Điều chỉnh
      </Button>
    );
  return (
    <form action={action} className="flex w-full flex-wrap items-end gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <div className="min-w-48 flex-1">
        <Field label="Lý do điều chỉnh" name="reason" placeholder="VD: bấm nhầm" maxLength={100} required autoFocus />
      </div>
      <SubmitButton variant="outline">Hoàn tác giao dịch này</SubmitButton>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Thôi
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
