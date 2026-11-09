"use client";

import { useActionState, useState } from "react";
import { cancelClaimAction, claimRuleAction } from "@/app/actions/rules";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button } from "@/ui/primitives";

export function ClaimButton({ ruleId, ruleName }: { ruleId: number; ruleName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(claimRuleAction, undefined);
  if (state?.ok && !open) return <FormMessage state={state} />;
  if (!open)
    return (
      <Button onClick={() => setOpen(true)} className="min-h-12">
        Con đã làm
      </Button>
    );
  return (
    <form
      action={(fd) => {
        setOpen(false);
        action(fd);
      }}
      className="flex w-full flex-wrap items-end gap-2"
    >
      <input type="hidden" name="ruleId" value={ruleId} />
      <div className="min-w-48 flex-1">
        <Field label={`Ghi chú cho bố mẹ về “${ruleName}” (không bắt buộc)`} name="note" maxLength={200} autoFocus />
      </div>
      <SubmitButton className="min-h-12">Gửi bố mẹ duyệt</SubmitButton>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Thôi
      </Button>
      <FormMessage state={state?.error ? state : undefined} />
    </form>
  );
}

export function CancelClaimButton({ claimId }: { claimId: number }) {
  const [state, action] = useActionState(cancelClaimAction, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={claimId} />
      <SubmitButton variant="ghost">Hủy</SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
