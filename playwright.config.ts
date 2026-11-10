import { defineConfig, devices } from "@playwright/test";

// Nạp .env (nếu có) để test e2e đọc được DATABASE_URL (dựng dữ liệu trực tiếp trong DB).
try {
  process.loadEnvFile(".env");
} catch {
  // Không có .env (ví dụ trong CI): dùng biến môi trường sẵn có.
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
// E2E_PROD=1: chạy trên bản build production (design D10) để kiểm tra đúng CSP và HSTS; CI đặt biến này.
// Không đặt thì dùng `next dev` cho nhanh khi phát triển.
const PROD = process.env.E2E_PROD === "1";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: PROD ? `npx next build && npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Bản production luôn build mới, không dùng lại server dev đang chạy.
    reuseExistingServer: !process.env.CI && !PROD,
    timeout: PROD ? 600_000 : 120_000,
  },
});
