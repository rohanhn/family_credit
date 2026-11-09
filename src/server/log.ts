// Log sự kiện bảo mật (design D9). Không bao giờ truyền mật khẩu, PIN, token hay email thô vào đây.

export type SecurityEvent =
  | "login_failed"
  | "login_locked"
  | "login_rate_limited"
  | "signup_limited"
  | "pin_failed"
  | "pin_locked"
  | "device_enabled"
  | "device_revoked"
  | "password_changed"
  | "password_reset"
  | "invite_created"
  | "invite_accepted"
  | "authz_denied";

export type SecurityFields = {
  ip?: string;
  emailHash?: string;
  familyId?: number;
  parentId?: number;
  childId?: number;
  detail?: string;
};

type Sink = (event: SecurityEvent, fields: SecurityFields) => void;

let sink: Sink = (event, fields) => {
  console.log(JSON.stringify({ time: new Date().toISOString(), level: "info", kind: "security", event, ...fields }));
};

export function logSecurityEvent(event: SecurityEvent, fields: SecurityFields = {}): void {
  sink(event, fields);
}

/** Cho phép thay nơi ghi log (logger thật, hoặc thu lại trong test). */
export function setSecurityLogSink(next: Sink): void {
  sink = next;
}
