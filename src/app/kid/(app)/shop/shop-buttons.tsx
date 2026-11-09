"use client";

import { useActionState } from "react";
import { cancelRedemptionAction, redeemAction, setGoalAction } from "@/app/actions/shop";
import { FormMessage, SubmitButton } from "@/ui/form";

export function RedeemButton({ rewardId, highlight }: { rewardId: number; highlight?: boolean }) {
  const [state, action] = useActionState(redeemAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="rewardId" value={rewardId} />
      <SubmitButton variant={highlight ? "reward" : "primary"} size={highlight ? "lg" : "md"} className="min-h-12 w-full" pendingText="Đang gửi…">
        Đổi
      </SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}

export function CancelRedemptionButton({ redemptionId, label = "Hủy" }: { redemptionId: number; label?: string }) {
  const [state, action] = useActionState(cancelRedemptionAction, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={redemptionId} />
      <SubmitButton variant="ghost">{label}</SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}

/** Chọn phần thưởng làm mục tiêu (rewardId) hoặc bỏ mục tiêu (rewardId = null). */
export function GoalButton({ rewardId, label }: { rewardId: number | null; label: string }) {
  const [state, action] = useActionState(setGoalAction, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="rewardId" value={rewardId ?? ""} />
      <SubmitButton variant="ghost" className="min-h-11 text-sm">
        {label}
      </SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
