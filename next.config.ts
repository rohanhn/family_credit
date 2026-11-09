import type { NextConfig } from "next";
import { securityHeaders } from "./src/server/security-headers";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Host của APP_URL để kiểm tra Origin của Server Actions khi đi qua Traefik (design D8).
 * Lưu ý: `next build` đóng gói cấu hình này vào server.js của bản standalone, nên APP_URL phải
 * có lúc build (build arg của Docker), không chỉ lúc chạy.
 */
function appHosts(): string[] {
  const url = process.env.APP_URL;
  if (!url) return [];
  try {
    return [new URL(url).host];
  } catch {
    throw new Error(`APP_URL không hợp lệ: ${url}`);
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  experimental: {
    serverActions: { allowedOrigins: appHosts() },
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(isDev) }];
  },
};

export default nextConfig;
