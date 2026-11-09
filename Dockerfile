# syntax=docker/dockerfile:1
# Image production (design D8): next build standalone, chạy bằng user không phải root, không volume.

ARG NODE_IMAGE=node:22-alpine

# --- Cài dependency (cả dev, để build) ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- Build app và các script vận hành ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# APP_URL được đóng gói vào cấu hình lúc build (allowedOrigins của Server Actions).
ARG APP_URL=""
ENV APP_URL=${APP_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:scripts

# --- Image chạy ---
FROM ${NODE_IMAGE} AS runner
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
RUN echo '{"type":"module"}' > scripts/package.json \
    && chmod 0755 /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p .next/cache && chown node:node .next/cache

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
