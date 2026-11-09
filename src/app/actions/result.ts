import { DomainError } from "@/server/domain/errors";
import { logger } from "@/server/log";

// Kết quả Server Action cho useActionState: thông báo lỗi bằng tiếng Việt, không lộ chi tiết nội bộ.

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> } | undefined;

export function fail(error: string): ActionState {
  return { error };
}

/** Đổi lỗi thành thông báo cho người dùng. Lỗi không phải DomainError được ghi log và ẩn đi. */
export function fromError(err: unknown): ActionState {
  if (err instanceof DomainError) return { error: err.message };
  logger.error({ event: "action_failed", err }, "action_failed");
  return { error: "Có lỗi xảy ra, vui lòng thử lại" };
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export function int(form: FormData, key: string): number {
  const n = Number(str(form, key));
  return Number.isSafeInteger(n) ? n : NaN;
}
