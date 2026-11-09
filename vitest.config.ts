import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Nạp .env (nếu có) để test chống race đọc được DATABASE_URL_TEST.
try {
  process.loadEnvFile(".env");
} catch {
  // Không có .env (ví dụ trong CI): dùng biến môi trường sẵn có.
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/domain/**/*.test.ts", "tests/db/**/*.test.ts"],
    passWithNoTests: true,
    // PGlite (WASM) khởi động chậm ở lần chạy đầu khi chưa có cache; tránh lỗi timeout giả.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
