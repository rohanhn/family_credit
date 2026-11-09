import { randomBytes } from "node:crypto";
import { resetPasswordByEmail } from "../src/server/auth/parent-auth";
import { closeDb, getDb } from "../src/server/db/client";

// Công cụ quản trị (design D8/D9): đặt lại mật khẩu bố mẹ và xóa mọi phiên của người đó.
// Trong container: docker compose exec app node scripts/reset-password.js <email>
// Khi dev:         npx tsx --env-file=.env scripts/reset-password.ts <email>
// Mật khẩu mới được sinh ngẫu nhiên và in ra một lần; bố mẹ nên đổi lại sau khi đăng nhập.

async function main(): Promise<number> {
  const email = process.argv[2];
  if (!email) {
    console.error("Cách dùng: node scripts/reset-password.js <email>");
    return 2;
  }
  const newPassword = randomBytes(12).toString("base64url");
  try {
    const { revokedSessions } = await resetPasswordByEmail(getDb(), email, newPassword);
    console.log(`Đã đặt lại mật khẩu, đã hủy ${revokedSessions} phiên đăng nhập.`);
    console.log(`Mật khẩu tạm: ${newPassword}`);
    return 0;
  } catch (err) {
    console.error("Không đặt lại được mật khẩu:", err instanceof Error ? err.message : err);
    return 1;
  } finally {
    await closeDb();
  }
}

main().then((code) => {
  process.exitCode = code;
});
