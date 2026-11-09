import type { Page } from "@playwright/test";

/**
 * Gán một IP client ngẫu nhiên (qua X-Forwarded-For, như Traefik) cho trang, để các lượt test
 * không đụng giới hạn đăng ký/đăng nhập theo IP của nhau (design D9).
 */
export async function useRandomClientIp(page: Page): Promise<string> {
  const ip = `198.51.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  return ip;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e6)}@example.com`;
}
