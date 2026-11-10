"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db/client";
import { requireChild, requireParentWithFamily } from "@/server/auth/next";
import {
  approveTaskDay,
  cancelReport,
  createTask,
  pauseTask,
  rejectTaskDay,
  reportDone,
  resumeTask,
  updateTask,
  type TaskInput,
} from "@/server/domain/daily-tasks";
import { signed } from "@/lib/time";
import { fromError, int, str, type ActionState } from "./result";

// Server Actions nhiệm vụ hằng ngày (task 5.5).

function taskInput(form: FormData): TaskInput {
  return {
    name: str(form, "name"),
    points: int(form, "points"),
    weekdays: form.getAll("weekdays").map((v) => Number(v)),
    mode: str(form, "mode") || "individual",
    assignAll: str(form, "assignAll") === "1",
    childIds: form.getAll("childIds").map((v) => Number(v)),
  };
}

export async function createTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const task = await createTask(getDb(), auth.familyId, taskInput(form));
    refresh();
    return { ok: true, message: `Đã tạo "${task.name}", bắt đầu từ ngày mai` };
  } catch (err) {
    return fromError(err, { action: "createTaskAction", auth: auth, form });
  }
}

export async function updateTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const task = await updateTask(getDb(), auth.familyId, int(form, "taskId"), taskInput(form));
    refresh();
    return { ok: true, message: `Đã lưu "${task.name}", áp dụng từ ngày mai` };
  } catch (err) {
    return fromError(err, { action: "updateTaskAction", auth: auth, form });
  }
}

export async function pauseTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await pauseTask(getDb(), auth.familyId, int(form, "taskId"));
    refresh();
    return { ok: true, message: "Đã tạm dừng từ ngày mai" };
  } catch (err) {
    return fromError(err, { action: "pauseTaskAction", auth: auth, form });
  }
}

export async function resumeTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await resumeTask(getDb(), auth.familyId, int(form, "taskId"));
    refresh();
    return { ok: true, message: "Nhiệm vụ chạy lại từ ngày mai" };
  } catch (err) {
    return fromError(err, { action: "resumeTaskAction", auth: auth, form });
  }
}

export async function approveTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const childId = str(form, "childId");
    const participants = form.getAll("participants").map(Number);
    const txns = await approveTaskDay(getDb(), {
      familyId: auth.familyId,
      actorParentId: auth.parentId,
      taskId: int(form, "taskId"),
      date: str(form, "date"),
      childId: childId ? Number(childId) : undefined,
      participantIds: str(form, "group") === "1" ? participants : undefined,
    });
    refresh();
    return { ok: true, message: `Đã duyệt ${signed(txns[0]?.appliedAmount ?? 0)} cho ${txns.length} con`, data: { applied: String(txns[0]?.appliedAmount ?? 0) } };
  } catch (err) {
    return fromError(err, { action: "approveTaskAction", auth: auth, form });
  }
}

export async function rejectTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const childId = str(form, "childId");
    await rejectTaskDay(getDb(), {
      familyId: auth.familyId,
      actorParentId: auth.parentId,
      taskId: int(form, "taskId"),
      date: str(form, "date"),
      childId: childId ? Number(childId) : undefined,
      reason: str(form, "reason"),
    });
    refresh();
    return { ok: true, message: "Đã từ chối" };
  } catch (err) {
    return fromError(err, { action: "rejectTaskAction", auth: auth, form });
  }
}

// ---- Phía con ----

export async function kidReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    await reportDone(getDb(), kid, int(form, "taskId"));
    refresh();
    return { ok: true, message: "Đã báo bố mẹ" };
  } catch (err) {
    return fromError(err, { action: "kidReportAction", auth: kid, form });
  }
}

export async function kidCancelReportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    await cancelReport(getDb(), kid, int(form, "taskId"));
    refresh();
    return { ok: true };
  } catch (err) {
    return fromError(err, { action: "kidCancelReportAction", auth: kid, form });
  }
}
