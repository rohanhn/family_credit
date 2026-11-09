import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// Băm mật khẩu và PIN bằng argon2id (design D4); token phiên ngẫu nhiên 32 byte, DB chỉ lưu SHA-256.

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashSecret(secret: string): Promise<string> {
  // @node-rs/argon2 mặc định dùng Argon2id.
  return hash(secret);
}

export async function verifySecret(storedHash: string, secret: string): Promise<boolean> {
  try {
    return await verify(storedHash, secret);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** Chạy argon2 trên một hash giả để thời gian phản hồi như nhau khi email không tồn tại (design D9). */
export async function verifyDummy(secret: string): Promise<false> {
  dummyHash ??= hash("khong-ton-tai-" + randomToken(8));
  await verifySecret(await dummyHash, secret);
  return false;
}
