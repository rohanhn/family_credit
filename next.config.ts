import type { NextConfig } from "next";
import { securityHeaders } from "./src/server/security-headers";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  // Không đặt serverActions.allowedOrigins: Next so host của Origin với X-Forwarded-Host/Host,
  // và Traefik giữ nguyên host gốc. Nhờ vậy image không phụ thuộc domain; APP_URL chỉ đọc lúc chạy.
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
