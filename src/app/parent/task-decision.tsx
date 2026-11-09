"use client";

import { useActionState, useState } from "react";
import { approveTaskAction, rejectTaskAction } from "@/app/actions/tasks";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button } from "@/ui/primitives";

/**
 * Duyệt / tự đánh dấu / từ chối một mục nhiệm vụ trong ngày. Nhiệm vụ nhóm có ô tick các con đã
 * tham gia (mặc định chọn tất cả).
 */
export function TaskDecision({
  taskId,
  date,
  childId,
  members,
  pending,
}: {
  taskId: number;
  date: string;
  childId: number | null;
  members: { id: number; name: string }[];
  /** true: đang chờ duyệt (có nút Từ chối); false: con chưa báo (bố mẹ tự đánh dấu). */
  pending: boolean;
}) {
  const [approveState, approve] = useActionState(approveTaskAction, undefined);
  const [rejectState, reject] = useActionState(rejectTaskAction, undefined);
  const [rejecting, setRejecting] = useState(false);
  const isGroup = childId === null;

  const hidden = (
    <>
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="date" value={date} />
      {childId !== null && <input type="hidden" name="childId" value={childId} />}
    </>
  );

  if (rejecting) {
    return (
      <form action={reject} className="flex w-full flex-wrap items-end gap-2">
        {hidden}
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
    <form action={approve} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {hidden}
      {isGroup && (
        <fieldset className="flex w-full flex-wrap items-center gap-2">
          <legend className="sr-only">Ai đã tham gia?</legend>
          <input type="hidden" name="group" value="1" />
          <span className="text-[13px] font-bold text-muted" aria-hidden="true">
            Ai đã tham gia?
          </span>
          {members.map((m) => (
            <label key={m.id} className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border-2 border-black/15 px-3 text-sm font-extrabold has-[:checked]:border-primary has-[:checked]:bg-soft">
              <input type="checkbox" name="participants" value={m.id} defaultChecked className="size-4 accent-[var(--primary)]" />
              {m.name}
            </label>
          ))}
        </fieldset>
      )}
      {pending && (
        <Button variant="outline" onClick={() => setRejecting(true)}>
          Từ chối
        </Button>
      )}
      <SubmitButton variant={pending ? "primary" : "soft"}>{pending ? "Duyệt" : "Đánh dấu xong"}</SubmitButton>
      {(approveState?.error || rejectState?.error) && <FormMessage state={approveState?.error ? approveState : rejectState} />}
    </form>
  );
}
