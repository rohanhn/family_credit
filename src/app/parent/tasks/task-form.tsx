"use client";

import { useActionState, useState, type ReactNode } from "react";
import { createTaskAction, pauseTaskAction, resumeTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button } from "@/ui/primitives";

const DAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export type TaskFormValue = {
  taskId?: number;
  name: string;
  points: number | "";
  weekdays: number[];
  mode: "individual" | "group";
  assignAll: boolean;
  childIds: number[];
};

const EMPTY: TaskFormValue = { name: "", points: "", weekdays: [0, 1, 2, 3, 4, 5, 6], mode: "individual", assignAll: true, childIds: [] };

/** Form tạo / sửa nhiệm vụ (mockup ParentTaskForm / WebParentTasks). */
export function TaskForm({
  kids,
  initial,
  startLabel,
  onDone,
}: {
  kids: { id: number; name: string }[];
  initial?: TaskFormValue;
  startLabel: string;
  onDone?: () => void;
}) {
  const editing = !!initial?.taskId;
  const [state, action] = useActionState(editing ? updateTaskAction : createTaskAction, undefined);
  const [v, setV] = useState<TaskFormValue>(initial ?? EMPTY);
  const count = v.assignAll ? kids.length : v.childIds.length;
  const showMode = count > 1;

  const toggleDay = (d: number) => setV({ ...v, weekdays: v.weekdays.includes(d) ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d].sort() });
  const toggleKid = (id: number) =>
    setV({ ...v, assignAll: false, childIds: v.childIds.includes(id) ? v.childIds.filter((x) => x !== id) : [...v.childIds, id] });

  return (
    <form
      action={(fd) => {
        action(fd);
        if (!editing) setV(EMPTY);
        onDone?.();
      }}
      className="flex flex-col gap-3.5"
    >
      {editing && <input type="hidden" name="taskId" value={initial!.taskId} />}
      <div className="flex gap-2">
        <div className="flex-1">
          <Field label="Tên nhiệm vụ" name="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} maxLength={60} required />
        </div>
        <div className="w-24">
          <Field label="Điểm" name="points" type="number" min={1} step={1} inputMode="numeric" value={v.points} onChange={(e) => setV({ ...v, points: e.target.value === "" ? "" : Number(e.target.value) })} required />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-extrabold text-muted">Ngày áp dụng</legend>
        <div className="mt-1.5 grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((label, d) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="weekdays" value={d} checked={v.weekdays.includes(d)} onChange={() => toggleDay(d)} className="peer sr-only" />
              <span className="flex h-11 items-center justify-center rounded-xl bg-bg text-sm font-extrabold text-muted peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[13px] font-extrabold text-muted">Giao cho</legend>
        <input type="hidden" name="assignAll" value={v.assignAll ? "1" : "0"} />
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={v.assignAll}
            onClick={() => setV({ ...v, assignAll: !v.assignAll, childIds: [] })}
            className={`min-h-11 rounded-full border-2 px-3.5 font-extrabold ${v.assignAll ? "border-primary bg-soft" : "border-black/15 bg-card"}`}
          >
            Tất cả các con
          </button>
          {kids.map((k) => {
            const on = !v.assignAll && v.childIds.includes(k.id);
            return (
              <label key={k.id} className="cursor-pointer">
                <input type="checkbox" name="childIds" value={k.id} checked={on} onChange={() => toggleKid(k.id)} className="peer sr-only" />
                <span className={`flex min-h-11 items-center rounded-full border-2 px-3.5 font-extrabold peer-focus-visible:outline-3 peer-focus-visible:outline-ink ${on ? "border-primary bg-soft" : "border-black/15 bg-card"} ${v.assignAll ? "opacity-60" : ""}`}>
                  {k.name}
                </span>
              </label>
            );
          })}
        </div>
        {!v.assignAll && v.childIds.length === 0 && <span className="text-[13px] font-extrabold text-minus">Chọn ít nhất một con nhé</span>}
      </fieldset>

      {showMode ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-[13px] font-extrabold text-muted">Cách làm</legend>
          {(
            [
              ["individual", "Mỗi con làm riêng", "Mỗi con tự báo xong và được cộng điểm riêng."],
              ["group", "Cả nhóm làm chung", "Một con báo xong cho cả nhóm. Khi duyệt, mỗi con tham gia nhận đủ điểm."],
            ] as const
          ).map(([mode, title, desc]) => (
            <label key={mode} className="mt-1 cursor-pointer">
              <input type="radio" name="mode" value={mode} checked={v.mode === mode} onChange={() => setV({ ...v, mode })} className="peer sr-only" />
              <span className="flex flex-col gap-0.5 rounded-2xl border-3 border-transparent bg-bg px-3.5 py-2.5 peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
                <span className="font-extrabold">{title}</span>
                <span className="text-[13px] font-semibold text-muted">{desc}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <input type="hidden" name="mode" value="individual" />
      )}

      <FormMessage state={state} />
      <SubmitButton size="lg">{editing ? `Lưu (áp dụng từ ${startLabel})` : `Lưu (bắt đầu từ ${startLabel})`}</SubmitButton>
    </form>
  );
}

/**
 * Một dòng của bảng nhiệm vụ: các ô thông tin (render ở server) và cột thao tác căn phải. Bấm "Sửa" thì form sửa
 * hiện ở một dòng riêng rộng hết bảng ngay bên dưới, để cột thao tác không bị kéo giãn và các dòng vẫn thẳng hàng.
 */
type TaskActionTarget = TaskFormValue & { taskId: number; paused: boolean };

/** Trạng thái thao tác của một nhiệm vụ (sửa, tạm dừng, chạy lại), dùng chung cho dòng bảng và thẻ (design D4). */
export function useTaskActions() {
  const [editing, setEditing] = useState(false);
  const [pState, pause] = useActionState(pauseTaskAction, undefined);
  const [rState, resume] = useActionState(resumeTaskAction, undefined);
  return { editing, setEditing, pause, resume, message: pState ?? rState };
}

type TaskActions = ReturnType<typeof useTaskActions>;

/** Hai nút "Sửa"/"Đóng" và "Tạm dừng"/"Chạy lại", kèm thông báo kết quả. */
function TaskActionButtons({ task, actions, align }: { task: TaskActionTarget; actions: TaskActions; align: "start" | "end" }) {
  return (
    <div className={`flex flex-col gap-2 ${align === "end" ? "items-end" : "items-start"}`}>
      <div className={`flex flex-nowrap gap-2 whitespace-nowrap ${align === "end" ? "justify-end" : ""}`}>
        <Button variant="outline" onClick={() => actions.setEditing(!actions.editing)} aria-expanded={actions.editing}>
          {actions.editing ? "Đóng" : "Sửa"}
        </Button>
        <form action={task.paused ? actions.resume : actions.pause}>
          <input type="hidden" name="taskId" value={task.taskId} />
          <SubmitButton variant="soft">{task.paused ? "Chạy lại" : "Tạm dừng"}</SubmitButton>
        </form>
      </div>
      <FormMessage state={actions.message} />
    </div>
  );
}

function EditPanel({ task, kids, startLabel, actions }: { task: TaskActionTarget; kids: { id: number; name: string }[]; startLabel: string; actions: TaskActions }) {
  return (
    <div className="rounded-2xl bg-bg p-3">
      <TaskForm kids={kids} initial={task} startLabel={startLabel} onDone={() => actions.setEditing(false)} />
    </div>
  );
}

type TaskItemProps = { task: TaskActionTarget; kids: { id: number; name: string }[]; startLabel: string };

/** Dòng nhiệm vụ trong bảng (màn hình từ 768px); form sửa hiện ở dòng riêng bên dưới. */
export function TaskRow({ cells, colSpan, ...props }: TaskItemProps & { cells: ReactNode; colSpan: number }) {
  const actions = useTaskActions();
  return (
    <>
      <tr className={`align-top [&>td]:px-3.5 [&>td]:py-3 ${actions.editing ? "" : "[&>td]:border-b [&>td]:border-black/5"}`}>
        {cells}
        <td>
          <TaskActionButtons task={props.task} actions={actions} align="end" />
        </td>
      </tr>
      {actions.editing && (
        <tr>
          <td colSpan={colSpan} className="border-b border-black/5 px-3.5 pb-4">
            <EditPanel {...props} actions={actions} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Thẻ nhiệm vụ ở màn hình hẹp (dưới 768px); form sửa hiện ngay trong thẻ (spec ui-theme "Danh sách nhiệm vụ trên điện thoại"). */
export function TaskCard({ body, ...props }: TaskItemProps & { body: ReactNode }) {
  const actions = useTaskActions();
  return (
    <li className="flex flex-col gap-3 rounded-[22px] bg-card p-4 shadow-flat">
      {body}
      <TaskActionButtons task={props.task} actions={actions} align="start" />
      {actions.editing && <EditPanel {...props} actions={actions} />}
    </li>
  );
}
