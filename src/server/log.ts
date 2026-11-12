import pino, { type DestinationStream, type Logger } from "pino";

// Log có cấu trúc (JSON ra stdout, Docker gom lại) và log sự kiện bảo mật (design D9).
// Không bao giờ truyền mật khẩu, PIN, token, cookie hay email thô vào log; `redact` là lớp
// bảo vệ thứ hai nếu lỡ truyền nhầm.

const REDACT_PATHS = [
  "password",
  "currentPassword",
  "newPassword",
  "pin",
  "token",
  "cookie",
  "email",
  "*.password",
  "*.pin",
  "*.token",
  "*.cookie",
  "*.email",
];

export function createLogger(destination?: DestinationStream): Logger {
  const options = {
    base: { app: "family_credit" },
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[ẩn]" },
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export type SecurityEvent =
  | "login_failed"
  | "login_locked"
  | "login_rate_limited"
  | "signup_limited"
  | "pin_failed"
  | "pin_locked"
  | "pin_changed"
  | "pin_reset"
  | "device_enabled"
  | "device_revoked"
  | "password_changed"
  | "password_reset"
  | "invite_created"
  | "invite_accepted"
  | "authz_denied";

/** Chỉ các trường được phép; email luôn ở dạng SHA-256 (`emailHash`). */
export type SecurityFields = {
  ip?: string;
  emailHash?: string;
  familyId?: number;
  parentId?: number;
  childId?: number;
  detail?: string;
};

type Sink = (event: SecurityEvent, fields: SecurityFields) => void;

const defaultSink: Sink = (event, fields) => logger.info({ kind: "security", event, ...fields }, event);
let sink: Sink = defaultSink;

export function logSecurityEvent(event: SecurityEvent, fields: SecurityFields = {}): void {
  sink(event, fields);
}

/** Thay nơi ghi log sự kiện bảo mật (thu lại trong test); gọi không tham số để về mặc định. */
export function setSecurityLogSink(next?: Sink): void {
  sink = next ?? defaultSink;
}
