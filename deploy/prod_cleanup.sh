#!/usr/bin/env bash
# Xóa image cũ của my-credit trên VPS. Chạy trong thư mục chứa compose.yaml và .env:
#   cd /opt/my-credit && ./prod_cleanup.sh
# Chỉ đụng tới image ghcr.io/<GHCR_OWNER>/my-credit; image của app khác, Traefik, Postgres giữ nguyên.
# Giữ lại: image container app đang dùng và image theo IMAGE_TAG trong .env. Rollback về tag cũ thì
# prod_up.sh sẽ pull lại từ GHCR.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "prod_cleanup: không thấy .env trong $(pwd)" >&2
  exit 1
fi

env_value() {
  grep -E "^[[:space:]]*$1=" .env | tail -n 1 | cut -d= -f2- | tr -d "\"'" || true
}

owner="$(env_value GHCR_OWNER | tr '[:upper:]' '[:lower:]')"
tag="$(env_value IMAGE_TAG)"
if [ -z "$owner" ] || [ -z "$tag" ]; then
  echo "prod_cleanup: thiếu GHCR_OWNER hoặc IMAGE_TAG trong .env" >&2
  exit 1
fi
repo="ghcr.io/${owner}/my-credit"

# ID image cần giữ
keep=""
cid="$(docker compose ps -aq app 2>/dev/null || true)"
if [ -n "$cid" ]; then
  keep="$keep $(docker inspect -f '{{.Image}}' "$cid")"
fi
if docker image inspect "${repo}:${tag}" >/dev/null 2>&1; then
  keep="$keep $(docker image inspect -f '{{.Id}}' "${repo}:${tag}")"
fi
if [ -z "${keep// /}" ]; then
  echo "prod_cleanup: không xác định được image đang dùng (chưa có container app và chưa pull ${repo}:${tag}); dừng để tránh xóa nhầm" >&2
  exit 1
fi

removed=0
failed=0
while read -r ref id; do
  full_id="$(docker image inspect -f '{{.Id}}' "$id")"
  case " $keep " in *" $full_id "*) continue ;; esac
  # Image không còn tag (<none>) thì xóa theo ID, còn lại xóa theo repo:tag
  if [ "${ref##*:}" = "<none>" ]; then target="$id"; else target="$ref"; fi
  if docker rmi "$target" >/dev/null 2>&1; then
    echo "prod_cleanup: đã xóa $target"
    removed=$((removed + 1))
  else
    echo "prod_cleanup: không xóa được $target (có container khác đang dùng?)" >&2
    failed=$((failed + 1))
  fi
done < <(docker images "$repo" --format '{{.Repository}}:{{.Tag}} {{.ID}}')

echo "prod_cleanup: xong, đã xóa ${removed}, lỗi ${failed}. Giữ ${repo}:${tag} và image đang chạy."
docker images "$repo"
