import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * Log của server khi chạy e2e, để test kiểm tra cảnh báo của Next (design D5 của change polish-after-mvp).
 * Bản production (`E2E_PROD=1`) ghi qua `tee` trong `playwright.config.ts`; `next dev` tự ghi vào `.next/dev/logs`.
 */
export const E2E_SERVER_LOG = process.env.E2E_PROD === "1" ? ".next/e2e-server.log" : ".next/dev/logs/next-development.log";

/** Đánh dấu vị trí hiện tại của log; hàm trả về đọc phần log ghi thêm từ lúc đánh dấu. Null nếu không có log. */
export function markServerLog(): (() => string) | null {
  if (!existsSync(E2E_SERVER_LOG)) return null;
  const start = statSync(E2E_SERVER_LOG).size;
  return () => readFileSync(E2E_SERVER_LOG).subarray(start).toString("utf8");
}
