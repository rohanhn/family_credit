# syntax=docker/dockerfile:1
# Image production (design D8): next build standalone, chạy bằng user không phải root, không volume.

# Image gốc ghi thẳng tên kèm digest ở mỗi stage (không qua ARG) để Dependabot đọc và mở PR cập nhật được.
# Đổi digest thì đổi ở cả ba dòng FROM.

# --- Cài dependency (cả dev, để build) ---
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- Build app và các script vận hành ---
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# APP_URL được đóng gói vào cấu hình lúc build (allowedOrigins của Server Actions).
ARG APP_URL=""
ENV APP_URL=${APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:scripts

# --- Image chạy ---
FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Mã nguồn thuộc root (chỉ đọc với user chạy app); chỉ thư mục cache của Next là ghi được.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist/scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Lúc chạy chỉ cần node: gỡ npm/corepack đi kèm image gốc (bớt bề mặt tấn công, và các lỗ hổng
# trong dependency của npm không còn làm Trivy chặn image).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && echo '{"type":"module"}' > scripts/package.json \
    && chmod 0755 /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
