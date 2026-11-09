"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions/result";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button } from "@/ui/primitives";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Nút Duyệt / Từ chối (kèm lý do tùy chọn) cho một mục trong hàng chờ duyệt chung. */
export function DecisionForm({
  id,
  approve,
  reject,
  extra,
}: {
  id: number;
  approve: Action;
  reject: Action;
  /** Trường bổ sung gửi kèm khi duyệt (ví dụ danh sách con tham gia nhiệm vụ nhóm). */
  extra?: React.ReactNode;
}) {
  const [approveState, approveAction] = useActionState(approve, undefined);
  const [rejectState, rejectAction] = useActionState(reject, undefined);
  const [rejecting, setRejecting] = useState(false);
  const state = approveState ?? rejectState;

  if (rejecting) {
    return (
      <form action={rejectAction} className="flex w-full flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <div className="min-w-48 flex-1">
          <Field label="Lý do (không bắt buộc)" name="reason" maxLength={200} autoFocus />
        </div>
        <SubmitButton variant="outline">Từ chối</SubmitButton>
        <Button variant="ghost" onClick={() => setRejecting(false)}>
          Thôi
        </Button>
        <FormMessage state={rejectState} />
      </form>
    );
  }

  return (
    <form action={approveAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {extra}
      <Button variant="outline" onClick={() => setRejecting(true)}>
        Từ chối
      </Button>
      <SubmitButton>Duyệt</SubmitButton>
      {state?.error && <FormMessage state={state} />}
    </form>
  );
}
