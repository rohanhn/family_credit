#!/usr/bin/env bash
# Tắt my-credit trên VPS. Chạy trong thư mục chứa compose.yaml và .env:
#   cd /opt/my-credit && ./prod_down.sh
# Xóa container của app. App không giữ trạng thái; dữ liệu nằm ở Postgres nên không mất gì.
# Network proxy-net/db-network là external nên không bị xóa; Traefik và Postgres không bị ảnh hưởng.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "prod_down: không thấy .env trong $(pwd)" >&2
  exit 1
fi

echo "prod_down: tắt app"
docker compose down
echo "prod_down: xong"
