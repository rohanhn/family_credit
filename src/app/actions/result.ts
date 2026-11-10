import { DomainError } from "@/server/domain/errors";
import { logger, logSecurityEvent } from "@/server/log";

// Kết quả Server Action cho useActionState: thông báo lỗi bằng tiếng Việt, không lộ chi tiết nội bộ.

export type ActionState = { ok?: boolean; error?: string; message?: string; data?: Record<string, string> } | undefined;

export function fail(error: string): ActionState {
  return { error };
}

/** Ngữ cảnh của Server Action đã qua guard (có phiên hợp lệ), dùng để ghi `authz_denied`. */
export type ActionContext = {
  action: string;
  auth: { familyId?: number | null; parentId?: number; childId?: number };
  form?: FormData;
};

/** Các id được yêu cầu trong form (trường `id` hoặc tên kết thúc bằng `Id`), chỉ giá trị số, không gồm dữ liệu cá nhân. */
function requestedIds(form: FormData | undefined): string {
  if (!form) return "";
  const parts: string[] = [];
  for (const [key, value] of form.entries()) {
    if ((key === "id" || /Id$/.test(key)) && typeof value === "string" && /^\d{1,12}$/.test(value)) parts.push(`${key}=${value}`);
  }
  return parts.join(",");
}

/**
 * Đổi lỗi thành thông báo cho người dùng. Lỗi không phải DomainError được ghi log và ẩn đi.
 * Có `ctx` (action đã qua guard) mà lỗi là NOT_FOUND thì ghi `authz_denied` (design D9): domain trả NOT_FOUND
 * cho cả dữ liệu của gia đình khác. Có thể ghi thừa khi mục bị xóa thật; log chỉ dùng để theo dõi.
 */
export function fromError(err: unknown, ctx?: ActionContext): ActionState {
  if (err instanceof DomainError) {
    if (err.code === "NOT_FOUND" && ctx) {
      const ids = requestedIds(ctx.form);
      logSecurityEvent("authz_denied", {
        familyId: ctx.auth.familyId ?? undefined,
        parentId: ctx.auth.parentId,
        childId: ctx.auth.childId,
        detail: ids ? `${ctx.action} ${ids}` : ctx.action,
      });
    }
    return { error: err.message };
  }
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
