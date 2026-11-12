#!/usr/bin/env bash
# Chạy thử image vừa build trước khi push (design D10, task 7.2): bắt lỗi bản standalone thiếu module.
# - Container chạy migration lúc khởi động (docker-entrypoint.sh), rồi /api/health phải trả 200.
# - `node scripts/reset-password.js` chạy được với một email đã seed (cần @node-rs/argon2 và driver Postgres).
# Cách dùng: DATABASE_URL=postgres://... scripts/ci-smoke-image.sh <image>
# Cần docker và curl. Container dùng mạng host để tới Postgres ở localhost; seed dữ liệu bằng psql của image postgres.
set -euo pipefail

IMAGE="${1:?Cách dùng: scripts/ci-smoke-image.sh <image>}"
: "${DATABASE_URL:?Thiếu DATABASE_URL}"
PORT="${SMOKE_PORT:-3000}"
NAME="family_credit-smoke-$$"
EMAIL="smoke-$(date +%s)-$$@example.com"

cleanup() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo "--- log container ---"
    docker logs "$NAME" 2>&1 | tail -50 || true
  fi
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  exit "$code"
}
trap cleanup EXIT

docker run -d --name "$NAME" --network host -e DATABASE_URL="$DATABASE_URL" -e PORT="$PORT" "$IMAGE" >/dev/null

echo "Chờ /api/health trả 200 (migration chạy trước khi server nhận traffic)…"
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}/api/health" || true)" = "200" ]; then
    ok=1
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" != "true" ]; then
    echo "Container đã dừng" >&2
    exit 1
  fi
  sleep 1
done
if [ "${ok:-0}" != "1" ]; then
  echo "/api/health không trả 200 sau 60 giây" >&2
  exit 1
fi
echo "/api/health: 200"

# Chạy SQL bằng psql trong image postgres (không cần psql trên máy chạy CI; bản standalone không có driver để import).
sql() {
  docker run --rm --network host -e PGCONNECT_TIMEOUT=10 postgres:16-alpine \
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "$1"
}

sql "insert into parents (email, display_name, password_hash) values ('${EMAIL}', 'Smoke', 'x')"
out="$(docker exec "$NAME" node scripts/reset-password.js "$EMAIL")"
echo "$out" | grep -q "Đã đặt lại mật khẩu" || {
  echo "reset-password.js không chạy được: $out" >&2
  exit 1
}
echo "reset-password.js: chạy được"
sql "delete from parents where email = '${EMAIL}'"
