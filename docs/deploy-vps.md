# Triển khai my-credit lên VPS

Tài liệu này đi từng bước, từ lúc phát hành image trên GitHub tới lúc app chạy trên VPS, kèm cập nhật, rollback, sao lưu và xử lý sự cố. Biến môi trường và quy trình dev xem thêm ở [README](../README.md).

## Tổng quan

```
Trình duyệt ──HTTPS──▶ Traefik ──(network TRAEFIK_NETWORK)──▶ app:3000
                                                               │
                                       (network POSTGRES_NETWORK)
                                                               ▼
                                                          Postgres 16
```

- CI build image và đẩy lên `ghcr.io/<owner>/my-credit`. VPS không cần mã nguồn, chỉ cần `compose.yaml`, `.env` và `backup.sh`.
- Container app không publish port nào ra host. Mọi request đi qua Traefik, nên `X-Forwarded-For` đáng tin.
- Container chạy với file system chỉ đọc, bỏ mọi capability, user `node`. Chỉ `/tmp` và `/app/.next/cache` ghi được (tmpfs).
- Mỗi lần container khởi động, entrypoint chạy migration trước rồi mới chạy server. Migration lỗi thì container dừng với mã lỗi.

## Điều kiện trên VPS

- Docker Engine và plugin `docker compose`.
- Traefik đang chạy trong Docker, có entrypoint HTTPS (thường là `websecure`) và một certresolver (ví dụ `letsencrypt`).
- PostgreSQL 16 chạy trong Docker, nằm trên một Docker network riêng.
- Bản ghi DNS của domain app (ví dụ `app3.domain.xyz`) trỏ về IP của VPS.
- `age` để mã hóa bản sao lưu (`sudo apt install age` trên Debian/Ubuntu).

Kiểm tra nhanh:

```bash
docker compose version
docker network ls                # ghi lại tên network của Traefik và của Postgres
docker ps --format '{{.Names}}\t{{.Networks}}'
```

## Bước 1: Chuẩn bị trên GitHub (một lần)

Vào Settings → Secrets and variables → Actions → **Variables**, tạo biến `APP_URL` bằng địa chỉ công khai của app, ví dụ `https://app3.domain.xyz`.

`APP_URL` được đóng vào image **lúc build** (thêm host vào `allowedOrigins` của Server Actions). Nếu đặt sai hoặc quên, image vẫn build được nhưng CI cảnh báo, và trên VPS các thao tác có form (đăng nhập, tạo rule) sẽ bị chặn. Đổi domain thì phải đổi biến này và phát hành image mới.

Đăng nhập GHCR trong CI dùng `GITHUB_TOKEN`, không cần secret.

## Bước 2: Phát hành image

CI (`.github/workflows/ci.yml`) chạy kiểm tra (lint, typecheck, audit, unit, chống race, e2e), build image, chạy thử image với Postgres (migration, `/api/health`, `reset-password.js`), quét Trivy, rồi mới push:

| Sự kiện | Tag image được push |
| --- | --- |
| Pull request vào `master` | Không push (chỉ build, chạy thử, quét) |
| Push lên `master` | `sha-<short>`, `latest` |
| Push tag `vX.Y.Z` | `sha-<short>`, `vX.Y.Z` |

Phát hành một phiên bản:

```bash
git checkout master && git pull
git tag v0.1.0
git push origin v0.1.0
```

Khi CI xanh, image `ghcr.io/<owner>/my-credit:v0.1.0` có trong mục Packages của repo. Trên production luôn dùng tag `vX.Y.Z`, không dùng `latest`.

## Bước 3: Tạo role và database trên Postgres

App dùng role và database riêng trên server Postgres dùng chung. Thay `postgres` bằng tên container Postgres trên VPS:

```bash
docker exec -it postgres psql -U postgres
```

```sql
CREATE ROLE my_credit LOGIN PASSWORD 'mat-khau-manh';
CREATE DATABASE my_credit OWNER my_credit;
REVOKE ALL ON DATABASE my_credit FROM PUBLIC;
```

Tạo mật khẩu ngẫu nhiên, ví dụ `openssl rand -base64 32 | tr -d '/+='` (bỏ ký tự đặc biệt để khỏi phải escape trong URL và shell).

## Bước 4: Chép file triển khai lên VPS

Từ thư mục repo trên máy của bạn:

```bash
ssh vps 'sudo mkdir -p /opt/my-credit && sudo chown "$USER" /opt/my-credit'
scp deploy/compose.yaml deploy/.env.example scripts/backup.sh vps:/opt/my-credit/
```

## Bước 5: Tạo `.env`

```bash
cd /opt/my-credit
cp .env.example .env && chmod 600 .env
nano .env
```

| Biến | Giá trị |
| --- | --- |
| `GHCR_OWNER` | User hoặc org GitHub sở hữu package, **viết thường** |
| `IMAGE_TAG` | Tag đã phát hành, ví dụ `v0.1.0` |
| `APP_HOST` | Domain, ví dụ `app3.domain.xyz` (dùng cho rule `Host()` của Traefik) |
| `APP_URL` | `https://` + domain, trùng với biến repo `APP_URL` lúc build |
| `DATABASE_URL` | `postgres://my_credit:<mật khẩu>@<tên service Postgres>:5432/my_credit` |
| `DATABASE_POOL_MAX` | Mặc định `5` |
| `LOG_LEVEL` | Mặc định `info` |
| `TRAEFIK_NETWORK` | Tên network của Traefik (từ `docker network ls`) |
| `TRAEFIK_ENTRYPOINT` | Entrypoint HTTPS của Traefik, mặc định `websecure` |
| `TRAEFIK_CERTRESOLVER` | Tên certresolver trong cấu hình Traefik |
| `POSTGRES_NETWORK` | Tên network của Postgres |
| `BACKUP_*`, `PG_IMAGE` | Điền ở [bước sao lưu](#bước-8-cài-sao-lưu) |

Host trong `DATABASE_URL` là tên container hoặc tên service của Postgres trên `POSTGRES_NETWORK`, không phải `localhost`.

Kiểm tra cú pháp và biến bắt buộc:

```bash
docker compose config --quiet && echo OK
```

## Bước 6: Đăng nhập GHCR (nếu package riêng tư)

Tạo Personal Access Token (classic) chỉ có quyền `read:packages`, rồi trên VPS:

```bash
docker login ghcr.io -u <github-user>   # dán token khi được hỏi mật khẩu
```

Package công khai thì bỏ qua bước này.

## Bước 7: Khởi động

```bash
cd /opt/my-credit
docker compose pull
docker compose up -d
docker compose ps                 # STATUS chuyển sang (healthy) sau khoảng 30 giây
docker compose logs -f app        # Ctrl+C để thoát
```

Healthcheck gọi `GET /api/health`, trả 200 khi truy vấn được DB.

Kiểm tra sau lần đầu:

1. Mở `https://<APP_HOST>`, chứng chỉ HTTPS hợp lệ.
2. Đăng ký tài khoản bố mẹ và tạo gia đình.
3. Thử một thao tác có Server Action (đăng xuất rồi đăng nhập lại, tạo một rule) để chắc kiểm tra Origin không chặn nhầm request đi qua proxy.

## Bước 8: Cài sao lưu

`backup.sh` chạy `pg_dump -Fc` trong container `PG_IMAGE` trên network Postgres, mã hóa bằng `age` ngay trong luồng, ghi `BACKUP_DIR/my-credit-<thời điểm UTC>.dump.age` (quyền 600) và giữ `BACKUP_KEEP` bản mới nhất. Trên đĩa không có bản rõ.

Tạo cặp khóa trên **máy của bạn**, không phải VPS:

```bash
age-keygen -o my-credit-backup.key
# Public key: age1...
```

Cất `my-credit-backup.key` vào trình quản lý mật khẩu hoặc nơi an toàn ngoài VPS. Mất file này thì không giải mã được bản sao lưu nào.

Trên VPS:

```bash
cd /opt/my-credit && chmod 700 backup.sh
nano .env      # BACKUP_AGE_RECIPIENT=age1..., BACKUP_DIR, BACKUP_KEEP, PG_IMAGE
sudo mkdir -p /var/backups/my-credit && sudo chown "$USER" /var/backups/my-credit
./backup.sh    # chạy thử, in ra "backup: đã ghi ..."
```

`PG_IMAGE` phải có major bằng hoặc mới hơn server Postgres.

Cron hằng ngày lúc 3:15 (`crontab -e` của user chạy được docker):

```cron
15 3 * * * /opt/my-credit/backup.sh /opt/my-credit/.env >> /var/log/my-credit-backup.log 2>&1
```

Nên định kỳ chép `/var/backups/my-credit` ra ngoài VPS (`rsync`, `rclone` sang máy khác hoặc object storage). File đã mã hóa nên chép đi đâu cũng an toàn.

## Cập nhật lên bản mới

```bash
cd /opt/my-credit
./backup.sh                               # sao lưu trước mỗi lần cập nhật
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v0.2.0/' .env
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=50 app         # xem migration chạy xong
```

## Rollback

Đặt lại `IMAGE_TAG` về tag cũ rồi chạy lại:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v0.1.0/' .env
docker compose up -d
```

Migration của dự án chỉ thêm (thêm cột, thêm bảng), không đổi tên hay xóa trong cùng một bản phát hành, nên image cũ vẫn chạy được trên schema mới. Chỉ khi một bản phát hành có migration không tương thích ngược mới cần [khôi phục DB](#khôi-phục-từ-bản-sao-lưu) trước khi chạy image cũ.

## Khôi phục từ bản sao lưu

Private key không nằm trên VPS, nên giải mã trên máy của bạn rồi đẩy luồng dữ liệu qua SSH. Dừng app trước để không có ghi mới trong lúc khôi phục:

```bash
ssh vps 'cd /opt/my-credit && docker compose stop app'

age -d -i my-credit-backup.key my-credit-20261109-031500.dump.age \
  | ssh vps 'cd /opt/my-credit && set -a && . ./.env && set +a && \
      docker run --rm -i --network "$POSTGRES_NETWORK" -e DATABASE_URL "${PG_IMAGE:-postgres:16-alpine}" \
        sh -c "pg_restore --clean --if-exists --no-owner -d \"\$DATABASE_URL\""'

ssh vps 'cd /opt/my-credit && docker compose start app'
```

- File sao lưu đang nằm trên VPS thì chép về trước: `scp vps:/var/backups/my-credit/<file> .`
- `. ./.env` đọc file như script shell. Nếu mật khẩu có ký tự đặc biệt của shell (`$`, dấu nháy), đặt giá trị trong nháy đơn trong `.env`, hoặc export `DATABASE_URL` và `POSTGRES_NETWORK` bằng tay.
- Muốn thử khôi phục mà không đụng production: tạo database khác (ví dụ `my_credit_restore`, owner `my_credit`) và trỏ `-d` vào đó.

## Việc vận hành thường gặp

Đặt lại mật khẩu bố mẹ (in mật khẩu mới ra màn hình, thu hồi mọi phiên của tài khoản đó):

```bash
cd /opt/my-credit
docker compose exec app node scripts/reset-password.js <email>
```

Xem log:

```bash
docker compose logs -f --tail=100 app
```

Log của container xoay vòng 5 file × 10 MB. Đổi mức log bằng `LOG_LEVEL` trong `.env` rồi `docker compose up -d`.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| `docker compose config` báo `Đặt ... trong .env` | Thiếu biến bắt buộc | Điền biến đó trong `.env` |
| `pull access denied` / `denied` khi pull | Package riêng tư, chưa đăng nhập GHCR, hoặc `GHCR_OWNER` có chữ hoa | [Bước 6](#bước-6-đăng-nhập-ghcr-nếu-package-riêng-tư), viết thường `GHCR_OWNER` |
| `network ... declared as external, but could not be found` | Sai tên network | Đối chiếu `TRAEFIK_NETWORK`, `POSTGRES_NETWORK` với `docker network ls` |
| Container khởi động lại liên tục, log có lỗi migration | Không kết nối được DB, sai mật khẩu, hoặc migration lỗi | Xem `docker compose logs app`; kiểm tra host, mật khẩu trong `DATABASE_URL` và Postgres có trên `POSTGRES_NETWORK` |
| `ECONNREFUSED` / `getaddrinfo ENOTFOUND` tới DB | Host trong `DATABASE_URL` là `localhost` hoặc sai tên service | Dùng tên container/service Postgres trên network chung |
| `(unhealthy)` | App chạy nhưng `/api/health` không truy vấn được DB | Xem log; `docker compose exec app wget -qO- http://127.0.0.1:3000/api/health` |
| Traefik trả 404 | Sai `APP_HOST`, sai entrypoint, hoặc Traefik không thấy container | Kiểm tra `APP_HOST`, `TRAEFIK_ENTRYPOINT`, nhãn `traefik.docker.network` và dashboard/log của Traefik |
| Chứng chỉ không hợp lệ | DNS chưa trỏ về VPS hoặc sai `TRAEFIK_CERTRESOLVER` | Kiểm tra DNS và log ACME của Traefik |
| Mở được trang nhưng đăng nhập/gửi form báo lỗi | Host của `APP_URL` lúc build image khác domain thật | Sửa biến repo `APP_URL`, phát hành tag mới, cập nhật `IMAGE_TAG` |
| Đăng nhập xong vẫn bị đá ra | Truy cập qua HTTP; cookie có cờ `Secure` | Luôn vào bằng `https://` |
