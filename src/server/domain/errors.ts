// Lỗi nghiệp vụ có mã ổn định để UI hiển thị thông báo phù hợp.

export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "INSUFFICIENT_BALANCE"
  | "RATE_LIMITED"
  | "LOCKED"
  | "INVALID_CREDENTIALS";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const notFound = (what = "Không tìm thấy") => new DomainError("NOT_FOUND", what);
export const invalid = (message: string) => new DomainError("INVALID_INPUT", message);
