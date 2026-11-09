#!/bin/sh
# Chạy migration trước khi server nhận traffic (design D2/D8). Migration lỗi thì container dừng với mã lỗi.
set -e

node /app/scripts/migrate.js

exec "$@"
