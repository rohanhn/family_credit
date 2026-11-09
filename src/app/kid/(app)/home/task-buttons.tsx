"use client";

import { useActionState } from "react";
import { kidCancelReportAction, kidReportAction } from "@/app/actions/tasks";
import { FormMessage, SubmitButton } from "@/ui/form";

export function ReportButton({ taskId, label = "Con xong rồi" }: { taskId: number; label?: string }) {
  const [state, action] = useActionState(kidReportAction, undefined);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <SubmitButton className="min-h-12 shrink-0" pendingText="Đang báo…">
        {label}
      </SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}

export function CancelReportButton({ taskId }: { taskId: number }) {
  const [state, action] = useActionState(kidCancelReportAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="taskId" value={taskId} />
      <SubmitButton variant="ghost" className="!min-h-8 !px-1 text-[13px]" pendingText="…">
        Hủy báo
      </SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
