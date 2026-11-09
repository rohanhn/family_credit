# Sao nhà mình (my-credit)

Ứng dụng web tự host giúp bố mẹ thưởng/phạt con bằng một "đồng tiền" riêng của gia đình: rule thưởng/phạt, nhiệm vụ hằng ngày, cửa hàng đổi thưởng, thông báo cho con. Bố mẹ đăng nhập bằng email và mật khẩu; con đăng nhập bằng avatar và PIN trên máy dùng chung của gia đình hoặc trên điện thoại riêng của con.

Công nghệ: Next.js 16 (App Router, Cache Components), PostgreSQL 16 qua Drizzle ORM, Playwright và Vitest. Thiết kế chi tiết nằm trong `openspec/changes/add-family-credit-mvp/` (`design.md`, các spec).

- [Chạy khi phát triển](#chạy-khi-phát-triển)
- [Biến môi trường](#biến-môi-trường)
- [Phát hành phiên bản](#phát-hành-phiên-bản)
- [Triển khai lần đầu trên VPS](#triển-khai-lần-đầu-trên-vps)
- [Cập nhật và rollback](#cập-nhật-và-rollback)
- [Sao lưu và khôi phục](#sao-lưu-và-khôi-phục)
- [Thiết bị của con](#thiết-bị-của-con)
- [Đặt lại mật khẩu bố mẹ](#đặt-lại-mật-khẩu-bố-mẹ)
- [Xem log sự kiện bảo mật](#xem-log-sự-kiện-bảo-mật)

## Chạy khi phát triển

Cần: Node.js 22, Docker (hoặc một server PostgreSQL 16 có sẵn).

1. Cài dependency:

   ```bash
   npm ci
   ```

2. Chuẩn bị PostgreSQL. App dùng role và database riêng trên một server Postgres dùng chung. Nếu máy chưa có Postgres, chạy một container:

   ```bash
   docker run -d --name shared-postgres --restart unless-stopped \
     -e POSTGRES_PASSWORD=postgres-dev -p 5432:5432 postgres:16-alpine
   ```

   Tạo role `my_credit` cùng hai database `my_credit` (dev) và `my_credit_test` (test chống race):

   ```bash
   docker exec -i shared-postgres psql -U postgres -v pw='mat-khau-dev' < scripts/dev-db-init.sql
   ```

3. Tạo file `.env` từ mẫu và điền mật khẩu vừa đặt vào `DATABASE_URL` và `DATABASE_URL_TEST`:

   ```bash
   cp .env.example .env
   ```

4. Tạo bảng rồi chạy server dev tại <http://localhost:3000>:

   ```bash
   npm run db:migrate
   npm run dev
   ```

Các lệnh thường dùng:

| Lệnh | Việc làm |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Kiểm tra kiểu |
| `npm test` | Unit test (PGlite trong bộ nhớ) và test chống race trên Postgres thật (cần `DATABASE_URL_TEST`, không có thì bỏ qua) |
| `npx playwright install chromium` | Cài trình duyệt cho e2e (một lần) |
| `npm run test:e2e` | E2E Playwright; tự chạy `next dev` ở cổng 3100 và dùng `DATABASE_URL` |
| `npm run db:generate` | Sinh migration mới từ `src/server/db/schema.ts` |
| `npm run reset-password <email>` | Đặt lại mật khẩu bố mẹ trên DB dev |

Migration chỉ nên thêm (thêm cột/bảng), không đổi tên hay xóa trong cùng một bản phát hành, để rollback image không cần khôi phục DB.

Build image ở máy để thử:

```bash
docker build --build-arg APP_URL=http://localhost:3000 -t my-credit:dev .
```

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `DATABASE_URL` | có | Chuỗi kết nối Postgres của app (role riêng `my_credit`). |
| `DATABASE_POOL_MAX` | không | Số kết nối tối đa trong pool, mặc định `5` (server Postgres dùng chung). |
| `APP_URL` | có trên production | Địa chỉ công khai, ví dụ `https://app3.domain.xyz`. Host của nó được thêm vào `allowedOrigins` của Server Actions **lúc build image** (build arg `APP_URL`; trong CI là biến repo `vars.APP_URL`). |
| `LOG_LEVEL` | không | Mức log của pino, mặc định `info`. |
| `DATABASE_URL_TEST` | chỉ khi test | Database riêng cho test chống race. |
| `E2E_PORT` | chỉ khi test | Cổng cho e2e, mặc định `3100`. Nếu đã có server chạy ở cổng đó (ngoài CI), Playwright dùng luôn server ấy. |

Trong image đã đặt sẵn `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`. Khi `NODE_ENV=production`, cookie luôn có cờ `Secure` (HTTPS kết thúc ở Traefik).

Biến chỉ dùng trên VPS (`deploy/.env.example`): `GHCR_OWNER`, `IMAGE_TAG`, `APP_HOST`, `TRAEFIK_NETWORK`, `TRAEFIK_ENTRYPOINT`, `TRAEFIK_CERTRESOLVER`, `POSTGRES_NETWORK`, và các biến sao lưu `BACKUP_AGE_RECIPIENT`, `BACKUP_DIR`, `BACKUP_KEEP`, `PG_IMAGE`.

## Phát hành phiên bản

CI (`.github/workflows/ci.yml`) chạy trên GitHub Actions:

- **Pull request vào `master`**: lint, typecheck, `npm audit --omit=dev --audit-level=high`, unit test, test chống race và e2e với Postgres 16. Không build image.
- **Push lên `master`**: chạy lại các kiểm tra, build image, quét bằng Trivy (dừng nếu có lỗ hổng HIGH/CRITICAL đã có bản vá), rồi push lên `ghcr.io/<owner>/my-credit` với tag `sha-<short>` và `latest`.
- **Push tag `vX.Y.Z`**: như trên, kèm tag `vX.Y.Z`.

Chuẩn bị một lần: trong GitHub vào Settings → Secrets and variables → Actions → Variables, tạo biến `APP_URL` (ví dụ `https://app3.domain.xyz`). Đăng nhập GHCR dùng `GITHUB_TOKEN` nên không cần secret.

Phát hành:

```bash
git checkout master && git pull
git tag v0.1.0
git push origin v0.1.0
```

Khi CI xanh, image `ghcr.io/<owner>/my-credit:v0.1.0` xuất hiện trong mục Packages của repo. Dependabot (`.github/dependabot.yml`) mở PR cập nhật npm, GitHub Actions và image Docker hằng tuần.

## Triển khai lần đầu trên VPS

Giả định VPS đã có Traefik (với entrypoint HTTPS và certresolver) và một Postgres chạy trong Docker; mỗi cái có một Docker network riêng. Container app nối vào cả hai network đó và không publish port nào ra host.

1. Tạo role và database trên Postgres (thay tên container và mật khẩu):

   ```bash
   docker exec -it postgres psql -U postgres
   ```

   ```sql
   CREATE ROLE my_credit LOGIN PASSWORD 'mat-khau-manh';
   CREATE DATABASE my_credit OWNER my_credit;
   REVOKE ALL ON DATABASE my_credit FROM PUBLIC;
   ```

2. Chép các file triển khai lên VPS (VPS không cần mã nguồn):

   ```bash
   ssh vps 'sudo mkdir -p /opt/my-credit && sudo chown "$USER" /opt/my-credit'
   scp deploy/compose.yaml deploy/.env.example scripts/backup.sh vps:/opt/my-credit/
   ```

3. Trên VPS, tạo `.env` và điền giá trị thật: `GHCR_OWNER`, `IMAGE_TAG` (một tag `vX.Y.Z` đã phát hành, không dùng `latest`), `APP_HOST`, `APP_URL`, `DATABASE_URL` (trỏ tới tên service Postgres trên network của nó, ví dụ `postgres://my_credit:…@postgres:5432/my_credit`), tên network và cấu hình Traefik.

   ```bash
   cd /opt/my-credit
   cp .env.example .env && chmod 600 .env
   nano .env
   ```

   Xem tên network có sẵn bằng `docker network ls`.

4. Nếu package trên GHCR là riêng tư, đăng nhập một lần bằng Personal Access Token (classic) chỉ có quyền `read:packages`:

   ```bash
   docker login ghcr.io -u <github-user>
   ```

5. Khởi động. Entrypoint chạy migration (giữ khóa advisory nên chạy nhiều container cũng an toàn) rồi mới chạy server; migration lỗi thì container dừng với mã lỗi.

   ```bash
   docker compose config --quiet   # kiểm tra .env
   docker compose pull
   docker compose up -d
   docker compose ps               # cột STATUS chuyển sang (healthy) sau khoảng 30 giây
   ```

   Healthcheck gọi `GET /api/health` (trả 200 khi truy vấn được DB). Mở `https://<APP_HOST>`, đăng ký tài khoản bố mẹ và tạo gia đình.

6. Cài sao lưu theo [phần dưới](#sao-lưu-và-khôi-phục).

Sau lần deploy đầu, nên tự thử một thao tác có Server Action (đăng nhập, tạo rule) qua domain thật để chắc kiểm tra Origin không chặn nhầm request đi qua proxy.

## Cập nhật và rollback

Cập nhật lên bản mới: sửa `IMAGE_TAG` trong `/opt/my-credit/.env`, rồi:

```bash
cd /opt/my-credit
docker compose pull
docker compose up -d
docker compose ps
```

Rollback: đặt lại `IMAGE_TAG` về tag cũ rồi chạy lại `docker compose up -d`. Vì migration chỉ thêm, image cũ vẫn chạy được trên schema mới. Chỉ khi một bản phát hành có migration không tương thích ngược mới cần [khôi phục từ bản sao lưu](#khôi-phục) trước khi chạy image cũ.

Nên sao lưu thủ công ngay trước mỗi lần cập nhật: `/opt/my-credit/backup.sh`.

## Sao lưu và khôi phục

`backup.sh` chạy `pg_dump -Fc` trong một container `postgres:<major>-alpine` trên network của Postgres, dẫn thẳng đầu ra qua `age` để mã hóa bằng public key, ghi thành `BACKUP_DIR/my-credit-<thời điểm UTC>.dump.age` (quyền 600) và giữ `BACKUP_KEEP` bản mới nhất (mặc định 14). Trên đĩa không bao giờ có bản rõ. `PG_IMAGE` phải có major bằng hoặc mới hơn server Postgres.

### Tạo cặp khóa age

Làm trên **máy của bạn**, không phải VPS:

```bash
age-keygen -o my-credit-backup.key
# Public key: age1...
```

Cất `my-credit-backup.key` (private key) vào trình quản lý mật khẩu hoặc nơi an toàn ngoài VPS; mất nó thì không giải mã được bản sao lưu nào. Chỉ đưa dòng `age1...` lên VPS.

### Cài trên VPS

```bash
sudo apt install age                     # Debian/Ubuntu
cd /opt/my-credit && chmod 700 backup.sh
nano .env                                # BACKUP_AGE_RECIPIENT=age1..., BACKUP_DIR, BACKUP_KEEP
sudo mkdir -p /var/backups/my-credit && sudo chown "$USER" /var/backups/my-credit
./backup.sh                              # chạy thử: "backup: đã ghi ..."
```

Cron hằng ngày lúc 3:15 (`crontab -e` của user có quyền chạy docker):

```cron
15 3 * * * /opt/my-credit/backup.sh /opt/my-credit/.env >> /var/log/my-credit-backup.log 2>&1
```

Nên chép thư mục sao lưu ra ngoài VPS định kỳ (ví dụ `rsync` hoặc `rclone` sang máy khác hay object storage). File đã mã hóa nên chép đi đâu cũng an toàn.

### Khôi phục

Private key không nằm trên VPS, nên giải mã trên máy của bạn rồi đẩy luồng dữ liệu qua SSH. Dừng app trước để không có ghi mới trong lúc khôi phục:

```bash
ssh vps 'cd /opt/my-credit && docker compose stop app'

age -d -i my-credit-backup.key my-credit-20261109-031500.dump.age \
  | ssh vps 'cd /opt/my-credit && set -a && . ./.env && set +a && \
      docker run --rm -i --network "$POSTGRES_NETWORK" -e DATABASE_URL "${PG_IMAGE:-postgres:16-alpine}" \
        sh -c "pg_restore --clean --if-exists --no-owner -d \"\$DATABASE_URL\""'

ssh vps 'cd /opt/my-credit && docker compose start app'
```

(`. ./.env` đọc file như script shell; nếu mật khẩu trong `DATABASE_URL` có ký tự đặc biệt của shell như `$` hay dấu nháy, hãy đặt giá trị trong nháy đơn trong `.env`, hoặc export `DATABASE_URL` và `POSTGRES_NETWORK` bằng tay.)

Nếu file sao lưu đang nằm trên VPS, chép nó về máy (`scp vps:/var/backups/my-credit/<file> .`) trước. Khôi phục ra một database khác để kiểm tra mà không đụng production: tạo database mới (ví dụ `my_credit_restore`, owner `my_credit`) và trỏ `-d` vào đó.

## Thiết bị của con

Con không có tài khoản riêng; con đăng nhập bằng PIN trên thiết bị bố mẹ đã bật. Bố mẹ đăng nhập trên thiết bị đó, bấm **Bật chế độ gia đình** ở đầu trang rồi chọn một trong hai kiểu. Bật xong, bố mẹ được đăng xuất khỏi thiết bị đó để con không vào được khu vực bố mẹ.

| | Máy dùng chung | Máy riêng của con |
|---|---|---|
| Ai đăng nhập được | Mọi con (chọn avatar) | Chỉ con được chọn |
| Phiên của con | 2 giờ, tự gia hạn khi dùng | Tới khi đóng hẳn trình duyệt hoặc app |
| Phiên thiết bị | 90 ngày cố định, sau đó bật lại | Tự gia hạn khi con còn dùng |

**Nhập PIN khi mở lại trên máy riêng.** Cookie phiên của con trên máy riêng không có hạn, nên đóng hẳn trình duyệt hoặc app (vuốt tắt khỏi danh sách app đang chạy) thì lần mở sau con phải nhập PIN. Chuyển sang app khác rồi quay lại thì không bị hỏi. Lưu ý: nếu trình duyệt bật "Tiếp tục từ nơi bạn đã dừng" (hoặc khôi phục tab khi mở lại), trình duyệt có thể giữ cookie này và con không bị hỏi PIN; khi đó phiên vẫn hết hạn sau tối đa 30 ngày ở phía server. Trên iPhone, mở từ icon ở màn hình chính thì app bị tắt hẳn là đủ.

**Thêm vào màn hình chính.** Trên điện thoại của con, mở trang của app:

- Android (Chrome): menu ⋮ → **Thêm vào màn hình chính** (hoặc **Cài đặt ứng dụng**).
- iPhone (Safari): nút Chia sẻ → **Thêm vào MH chính**.

Icon mở app ở chế độ toàn màn hình tại trang gốc, và app tự đưa con tới màn nhập PIN.

**Đổi PIN.** Con tự đổi trong mục **Đổi PIN** (sidebar trên máy tính; trên điện thoại ở cuối màn **Giao diện**, mở bằng avatar trên đầu trang): nhập PIN hiện tại rồi PIN mới hai lần. PIN mới dùng cho mọi thiết bị. Nhập sai PIN hiện tại 5 lần thì đăng nhập của con bị khóa 5 phút như khi đăng nhập. Con quên PIN thì bố mẹ đặt lại trong **Cài đặt → Các con → Sửa**; thẻ của từng con hiện "PIN đổi lần cuối".

**Thu hồi.** **Cài đặt → Thiết bị của con** liệt kê từng thiết bị ("Máy dùng chung" hoặc "Máy riêng của …") kèm nút **Thu hồi**. Lưu trữ hồ sơ một con cũng thu hồi máy riêng của con đó.

## Đặt lại mật khẩu bố mẹ

App không gửi email, nên người host đặt lại mật khẩu bằng lệnh. Lệnh sinh một mật khẩu tạm ngẫu nhiên, in ra một lần và **xóa mọi phiên đăng nhập** của bố mẹ đó:

```bash
cd /opt/my-credit
docker compose exec app node scripts/reset-password.js bo@example.com
# Đã đặt lại mật khẩu, đã hủy 2 phiên đăng nhập.
# Mật khẩu tạm: ...
```

Gửi mật khẩu tạm cho bố mẹ qua kênh riêng và nhắc họ đổi lại ngay trong phần cài đặt tài khoản. Khi phát triển: `npm run reset-password bo@example.com`.

## Xem log sự kiện bảo mật

App ghi log JSON ra stdout (pino); Docker giữ tối đa 5 file × 10 MB. Sự kiện bảo mật có `"kind":"security"` và trường `event`: `login_failed`, `login_locked`, `login_rate_limited`, `signup_limited`, `pin_failed`, `pin_locked`, `pin_changed`, `pin_reset`, `device_enabled` (trường `detail` là `shared` hoặc `personal`), `device_revoked`, `password_changed`, `password_reset`, `invite_created`, `invite_accepted`, `authz_denied`. Log không chứa mật khẩu, PIN, token hay cookie; email chỉ ở dạng SHA-256 (`emailHash`).

```bash
cd /opt/my-credit
# Mọi sự kiện bảo mật trong 24 giờ qua
docker compose logs --no-log-prefix --since 24h app | grep '"kind":"security"'

# Đăng nhập sai và bị khóa trong 7 ngày qua, gọn theo cột (cần jq)
docker compose logs --no-log-prefix --since 168h app \
  | grep '"kind":"security"' \
  | jq -r 'select(.event | test("login_failed|login_locked|pin_locked")) | [.time, .event, .ip, .familyId] | @tsv'
```

Riêng `password_reset` từ lệnh `reset-password` được in ra terminal chạy lệnh đó (tiến trình `exec` riêng), không nằm trong `docker compose logs`.
