#!/usr/bin/env bash
# Sao lưu database family_credit, mã hóa bằng age (design D8/D9). Chạy trên VPS bằng cron hằng ngày:
#   15 3 * * * /opt/family_credit/backup.sh /opt/family_credit/.env >> /var/log/family_credit-backup.log 2>&1
# Đối số: đường dẫn file .env (mặc định: .env cạnh script). Biến đã có trong môi trường được ưu tiên.
# Cần: docker, age. Đầu ra pg_dump đi thẳng qua age, trên đĩa không có bản rõ.
set -euo pipefail
umask 077

ENV_FILE="${1:-$(dirname "$0")/.env}"

# Đọc một khóa từ .env mà không source file (mật khẩu có thể chứa ký tự đặc biệt của shell).
env_value() {
  local key="$1" line value
  [ -f "$ENV_FILE" ] || return 0
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  printf '%s' "$value"
}

load() {
  local key="$1" default="${2:-}"
  if [ -z "${!key:-}" ]; then
    local v
    v="$(env_value "$key")"
    printf -v "$key" '%s' "${v:-$default}"
  fi
  if [ -z "${!key:-}" ]; then
    echo "backup: thiếu biến $key (trong $ENV_FILE hoặc môi trường)" >&2
    exit 2
  fi
}

load DATABASE_URL
load POSTGRES_NETWORK
load BACKUP_AGE_RECIPIENT
load BACKUP_DIR
load BACKUP_KEEP 14
load PG_IMAGE postgres:16-alpine

command -v age >/dev/null || { echo "backup: chưa cài age (apt install age)" >&2; exit 2; }
[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || { echo "backup: BACKUP_KEEP phải là số nguyên dương" >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%d-%H%M%S)"
final="$BACKUP_DIR/family_credit-$stamp.dump.age"
partial="$BACKUP_DIR/.family_credit-$stamp.dump.age.partial"
trap 'rm -f "$partial"' EXIT

# DATABASE_URL truyền qua biến môi trường (-e), không nằm trên dòng lệnh nên không lộ qua ps.
export DATABASE_URL
docker run --rm --network "$POSTGRES_NETWORK" -e DATABASE_URL "$PG_IMAGE" \
  sh -c 'exec pg_dump --format=custom "$DATABASE_URL"' \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$partial"

[ -s "$partial" ] || { echo "backup: file sao lưu rỗng" >&2; exit 1; }
chmod 600 "$partial"
mv "$partial" "$final"
echo "backup: đã ghi $final ($(du -h "$final" | cut -f1))"

# Giữ BACKUP_KEEP bản mới nhất (tên file có thời điểm nên sắp xếp theo tên là theo thời gian).
mapfile -t old < <(find "$BACKUP_DIR" -maxdepth 1 -name 'family_credit-*.dump.age' -type f | sort -r | tail -n +"$((BACKUP_KEEP + 1))")
if [ "${#old[@]}" -gt 0 ]; then
  rm -f -- "${old[@]}"
  echo "backup: đã xóa ${#old[@]} bản cũ"
fi
