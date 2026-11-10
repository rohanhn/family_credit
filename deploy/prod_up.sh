#!/usr/bin/env bash
# Bật (hoặc cập nhật) my-credit trên VPS. Chạy trong thư mục chứa compose.yaml và .env:
#   cd /opt/my-credit && ./prod_up.sh
# Các bước: kiểm tra .env, pull image theo IMAGE_TAG, up -d, chờ container (healthy).
# Container không healthy trong thời gian chờ thì in log và thoát với mã lỗi.
set -euo pipefail

cd "$(dirname "$0")"

TIMEOUT="${TIMEOUT:-120}"   # giây chờ healthy (migration chạy trước server)

if [ ! -f .env ]; then
  echo "prod_up: không thấy .env trong $(pwd)" >&2
  exit 1
fi

echo "prod_up: kiểm tra cấu hình"
docker compose config --quiet

tag="$(grep -E '^[[:space:]]*IMAGE_TAG=' .env | tail -n 1 | cut -d= -f2-)"
echo "prod_up: pull image (IMAGE_TAG=${tag})"
docker compose pull

echo "prod_up: khởi động"
docker compose up -d

cid="$(docker compose ps -q app)"
if [ -z "$cid" ]; then
  echo "prod_up: không tìm thấy container app" >&2
  exit 1
fi

echo "prod_up: chờ healthy (tối đa ${TIMEOUT}s)"
start="$(date +%s)"
while :; do
  state="$(docker inspect -f '{{.State.Status}}' "$cid")"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$cid")"
  if [ "$health" = "healthy" ]; then
    echo "prod_up: xong, container healthy"
    docker compose ps
    exit 0
  fi
  if [ "$health" = "unhealthy" ] || [ "$state" = "exited" ] || [ "$state" = "restarting" ]; then
    echo "prod_up: container lỗi (state=${state}, health=${health})" >&2
    break
  fi
  if [ $(( $(date +%s) - start )) -ge "$TIMEOUT" ]; then
    echo "prod_up: quá ${TIMEOUT}s mà chưa healthy (state=${state}, health=${health})" >&2
    break
  fi
  sleep 3
done

echo "--- 50 dòng log cuối của app ---" >&2
docker compose logs --tail=50 app >&2
exit 1
