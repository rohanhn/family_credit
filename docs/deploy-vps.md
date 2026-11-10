# Triển khai my-credit lên VPS

Hướng dẫn từng bước từ một VPS trắng tới lúc app chạy bằng HTTPS, kèm sao lưu, cập nhật, rollback và xử lý sự cố. Biến môi trường và quy trình dev xem thêm ở [README](../README.md).

VPS đã có Postgres hoặc Traefik thì bỏ qua bước tương ứng, chỉ cần ghi lại tên network, entrypoint và certresolver đang dùng để điền vào `.env` ở [bước 10](#bước-10-tạo-env).

## Mục lục

- [Tổng quan](#tổng-quan)
- **Phần A. Chuẩn bị VPS**
  - [Bước 1: Thuê VPS và trỏ DNS](#bước-1-thuê-vps-và-trỏ-dns)
  - [Bước 2: Tạo user và bảo mật SSH](#bước-2-tạo-user-và-bảo-mật-ssh)
  - [Bước 3: Cập nhật hệ thống, tường lửa, swap](#bước-3-cập-nhật-hệ-thống-tường-lửa-swap)
  - [Bước 4: Cài Docker](#bước-4-cài-docker)
  - [Bước 5: Tạo Docker network dùng chung](#bước-5-tạo-docker-network-dùng-chung)
- **Phần B. Hạ tầng dùng chung**
  - [Bước 6: Cài PostgreSQL](#bước-6-cài-postgresql)
  - [Bước 7: Cài Traefik](#bước-7-cài-traefik)
- **Phần C. Triển khai app**
  - [Bước 8: Phát hành image trên GitHub](#bước-8-phát-hành-image-trên-github)
  - [Bước 9: Tạo role và database cho app](#bước-9-tạo-role-và-database-cho-app)
  - [Bước 10: Tạo `.env`](#bước-10-tạo-env)
  - [Bước 11: Khởi động app](#bước-11-khởi-động-app)
  - [Bước 12: Cài sao lưu](#bước-12-cài-sao-lưu)
- **Phần D. Vận hành**: [cập nhật](#cập-nhật-lên-bản-mới), [rollback](#rollback), [khôi phục](#khôi-phục-từ-bản-sao-lưu), [việc thường gặp](#việc-vận-hành-thường-gặp), [xử lý sự cố](#xử-lý-sự-cố)

## Tổng quan

```
Trình duyệt ──HTTPS :443──▶ Traefik ──(network traefik)──▶ app:3000
                                                            │
                                                   (network postgres)
                                                            ▼
                                                       Postgres 16
```

Bố cục thư mục trên VPS:

```
/opt/traefik/     compose.yaml, letsencrypt/acme.json
/opt/postgres/    compose.yaml, .env (mật khẩu superuser)
/opt/my-credit/   compose.yaml, .env, backup.sh
/var/backups/my-credit/   bản sao lưu đã mã hóa
```

- Chỉ Traefik mở port ra ngoài (80, 443). Postgres và app không publish port nào.
- CI build image và đẩy lên `ghcr.io/<owner>/my-credit`. VPS không cần mã nguồn.
- Container app chạy file system chỉ đọc, bỏ mọi capability, user `node`. Mỗi lần khởi động, entrypoint chạy migration trước rồi mới chạy server; migration lỗi thì container dừng.

Trong tài liệu, lệnh bắt đầu bằng `ssh vps` hoặc `scp ... vps:` chạy trên **máy của bạn**; các lệnh khác chạy **trên VPS**.

---

## Phần A. Chuẩn bị VPS

### Bước 1: Thuê VPS và trỏ DNS

Cấu hình đề nghị:

- Ubuntu Server 24.04 LTS (các lệnh dưới viết cho Ubuntu/Debian).
- Tối thiểu 1 vCPU, 1 GB RAM (nên 2 GB), 20 GB đĩa.
- Có IPv4 công khai.

Tại nhà cung cấp tên miền, tạo bản ghi `A` cho domain của app (ví dụ `app3.domain.xyz`) trỏ về IP của VPS. Có IPv6 thì thêm bản ghi `AAAA`. Kiểm tra từ máy của bạn:

```bash
dig +short app3.domain.xyz        # phải ra IP của VPS
```

DNS phải trỏ đúng **trước** [bước 7](#bước-7-cài-traefik), nếu không Traefik không xin được chứng chỉ Let's Encrypt.

### Bước 2: Tạo user và bảo mật SSH

Trên máy của bạn, tạo SSH key nếu chưa có:

```bash
ssh-keygen -t ed25519 -C "my-credit-vps"
```

Đăng nhập VPS lần đầu bằng `root` (hoặc user nhà cung cấp cấp sẵn), tạo user `deploy` có quyền sudo:

```bash
ssh root@<IP>
adduser deploy
usermod -aG sudo deploy
```

Chép public key cho `deploy` (chạy trên máy của bạn):

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub deploy@<IP>
```

Thêm alias `vps` vào `~/.ssh/config` trên máy của bạn để các lệnh sau gọn hơn:

```
Host vps
    HostName <IP>
    User deploy
    IdentityFile ~/.ssh/id_ed25519
```

Thử `ssh vps` đăng nhập được **bằng key** rồi mới tắt đăng nhập bằng mật khẩu và đăng nhập root:

```bash
ssh vps
sudo tee /etc/ssh/sshd_config.d/99-hardening.conf >/dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo sshd -t && sudo systemctl reload ssh
```

Giữ phiên SSH hiện tại, mở thêm một terminal và thử `ssh vps` lần nữa. Đăng nhập được thì mới đóng phiên cũ.

### Bước 3: Cập nhật hệ thống, tường lửa, swap

Cập nhật và bật tự cài bản vá bảo mật:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades age
sudo dpkg-reconfigure -plow unattended-upgrades   # chọn Yes
```

(`age` dùng để mã hóa bản sao lưu ở bước 12.)

Tường lửa: chỉ mở SSH, HTTP, HTTPS.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Lưu ý: port mà container publish (`ports:`) đi thẳng qua iptables của Docker, **không** bị ufw chặn. Vì vậy trong tài liệu này chỉ Traefik publish port (80, 443); Postgres và app không publish gì. Đừng thêm `ports: 5432:5432` cho Postgres.

Swap (nên có nếu RAM dưới 2 GB):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### Bước 4: Cài Docker

Cài Docker Engine và plugin compose từ kho chính thức của Docker (không dùng gói `docker.io` của Ubuntu, thường cũ hơn):

```bash
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Cho user `deploy` chạy docker không cần sudo, rồi đăng xuất và đăng nhập lại:

```bash
sudo usermod -aG docker deploy
exit
```

```bash
ssh vps
docker run --rm hello-world
docker compose version
```

Thành viên nhóm `docker` có quyền tương đương root trên máy, nên chỉ thêm user tin cậy.

### Bước 5: Tạo Docker network dùng chung

Hai network riêng: `traefik` (Traefik nói chuyện với các app) và `postgres` (các app nói chuyện với Postgres). App nối vào cả hai; Traefik không thấy Postgres.

```bash
docker network create traefik
docker network create postgres
docker network ls
```

Tên này trùng với giá trị mặc định trong `deploy/.env.example` (`TRAEFIK_NETWORK=traefik`, `POSTGRES_NETWORK=postgres`).

---

## Phần B. Hạ tầng dùng chung

### Bước 6: Cài PostgreSQL

> VPS đã có Postgres 16 chạy trong Docker thì bỏ qua bước này. Ghi lại tên network của nó (`docker inspect <container> --format '{{json .NetworkSettings.Networks}}'`) và tên container để dùng ở bước 9 và 10.

Tạo thư mục và mật khẩu superuser:

```bash
sudo mkdir -p /opt/postgres && sudo chown deploy: /opt/postgres
cd /opt/postgres
printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -base64 32 | tr -d '/+=')" > .env
chmod 600 .env
```

Tạo `/opt/postgres/compose.yaml`:

```yaml
name: postgres

services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Đặt POSTGRES_PASSWORD trong .env}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - postgres
    # Không publish port: chỉ container trên network postgres kết nối được.
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"

volumes:
  pgdata:

networks:
  postgres:
    external: true
    name: postgres
```

Khởi động và kiểm tra:

```bash
docker compose up -d
docker compose ps                         # STATUS (healthy)
docker exec -it postgres psql -U postgres -c 'select version();'
```

Dữ liệu nằm trong volume `postgres_pgdata`. Đừng chạy `docker compose down -v` ở thư mục này: `-v` xóa luôn volume.

### Bước 7: Cài Traefik

> VPS đã có Traefik thì bỏ qua bước này. Ghi lại tên network, tên entrypoint HTTPS và tên certresolver của nó để điền vào `.env` ở bước 10.

Traefik nhận request ở port 80 và 443, chuyển HTTP sang HTTPS, tự xin và gia hạn chứng chỉ Let's Encrypt, rồi định tuyến tới container theo nhãn (label) của container đó.

```bash
sudo mkdir -p /opt/traefik/letsencrypt && sudo chown -R deploy: /opt/traefik
cd /opt/traefik
touch letsencrypt/acme.json && chmod 600 letsencrypt/acme.json
```

Tạo `/opt/traefik/compose.yaml` (thay email bằng email của bạn, Let's Encrypt gửi cảnh báo hết hạn tới đây):

```yaml
name: traefik

services:
  traefik:
    # Dùng bản v3 mới nhất. Với Docker Engine 29 trở lên cần Traefik từ v3.6.1.
    image: traefik:v3.6
    container_name: traefik
    restart: unless-stopped
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.docker.network=traefik
      - --entrypoints.web.address=:80
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=ban@example.com
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --log.level=INFO
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - traefik
    security_opt:
      - no-new-privileges:true
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"

networks:
  traefik:
    external: true
    name: traefik
```

Cấu hình này khớp với giá trị mặc định trong `deploy/.env.example`: entrypoint `websecure`, certresolver `letsencrypt`, network `traefik`. Chỉ container có nhãn `traefik.enable=true` mới được public (`exposedbydefault=false`); `compose.yaml` của app đã có sẵn các nhãn đó.

Khởi động và xem log:

```bash
docker compose up -d
docker compose logs -f traefik            # không có lỗi kết nối Docker là được; Ctrl+C để thoát
```

Lúc này chưa có app nên truy cập domain sẽ nhận `404 page not found` từ Traefik, đó là bình thường. Chứng chỉ được xin lần đầu khi app khởi động ở bước 11.

Muốn thử Let's Encrypt mà không đụng giới hạn tần suất, thêm tạm dòng `--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory`, thử xong thì bỏ dòng đó, xóa nội dung `acme.json` (`: > letsencrypt/acme.json`) và `docker compose up -d` lại.

---

## Phần C. Triển khai app

### Bước 8: Phát hành image trên GitHub

Image không đóng domain vào lúc build: `APP_URL` chỉ đặt trong `.env` ở [bước 10](#bước-10-tạo-env), nên CI không cần biến repo nào và đổi domain chỉ cần sửa `.env`. Đăng nhập GHCR trong CI dùng `GITHUB_TOKEN`, không cần secret.

Server Actions vẫn được chống CSRF: Next so host trong header `Origin` với `X-Forwarded-Host` (không có thì với `Host`). Traefik với cấu hình mặc định giữ nguyên `Host` và gắn `X-Forwarded-Host` bằng domain gốc, nên request hợp lệ khớp; request từ site khác bị chặn. Điều kiện là proxy phía trước **không được viết lại host** (xem [xử lý sự cố](#xử-lý-sự-cố)).

**Mỗi lần phát hành:** CI (`.github/workflows/ci.yml`) chạy kiểm tra (lint, typecheck, audit, unit, chống race, e2e), build image, chạy thử image với Postgres (migration, `/api/health`, `reset-password.js`), quét Trivy, rồi mới push:

| Sự kiện | Tag image được push |
| --- | --- |
| Pull request vào `master` | Không push (chỉ build, chạy thử, quét) |
| Push lên `master` | `sha-<short>`, `latest` |
| Push tag `vX.Y.Z` | `sha-<short>`, `vX.Y.Z` |

```bash
git checkout master && git pull
git tag v0.1.0
git push origin v0.1.0
```

Khi CI xanh, image `ghcr.io/<owner>/my-credit:v0.1.0` có trong mục Packages của repo. Trên production luôn dùng tag `vX.Y.Z`, không dùng `latest`.

**Package riêng tư:** mặc định package trên GHCR là riêng tư. Có hai cách:

- Đổi package sang công khai (Packages → my-credit → Package settings → Change visibility), hoặc
- Tạo Personal Access Token (classic) chỉ có quyền `read:packages`, rồi đăng nhập một lần trên VPS:

  ```bash
  docker login ghcr.io -u <github-user>   # dán token khi được hỏi mật khẩu
  ```

### Bước 9: Tạo role và database cho app

App dùng role và database riêng trên server Postgres dùng chung. Tạo mật khẩu cho role và **ghi lại** để dùng ở bước 10:

```bash
openssl rand -base64 32 | tr -d '/+='
```

(Bỏ ký tự `/`, `+`, `=` để khỏi phải escape trong URL và shell.)

```bash
docker exec -it postgres psql -U postgres
```

```sql
CREATE ROLE my_credit LOGIN PASSWORD '<mật khẩu vừa tạo>';
CREATE DATABASE my_credit OWNER my_credit;
REVOKE ALL ON DATABASE my_credit FROM PUBLIC;
\q
```

Thay `postgres` sau `docker exec -it` bằng tên container nếu Postgres có sẵn dùng tên khác.

### Bước 10: Tạo `.env`

Chép file triển khai từ repo lên VPS (chạy trên máy của bạn, ở thư mục repo):

```bash
ssh vps 'sudo mkdir -p /opt/my-credit && sudo chown deploy: /opt/my-credit'
scp deploy/compose.yaml deploy/.env.example scripts/backup.sh vps:/opt/my-credit/
```

Trên VPS:

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
| `APP_URL` | `https://` + domain, ví dụ `https://app3.domain.xyz`. Dùng lúc chạy để tạo link mời |
| `DATABASE_URL` | `postgres://my_credit:<mật khẩu bước 9>@postgres:5432/my_credit` |
| `DATABASE_POOL_MAX` | Mặc định `5` |
| `LOG_LEVEL` | Mặc định `info` |
| `TRAEFIK_NETWORK` | `traefik` (hoặc tên network Traefik có sẵn) |
| `TRAEFIK_ENTRYPOINT` | `websecure` (hoặc tên entrypoint HTTPS có sẵn) |
| `TRAEFIK_CERTRESOLVER` | `letsencrypt` (hoặc tên certresolver có sẵn) |
| `POSTGRES_NETWORK` | `postgres` (hoặc tên network Postgres có sẵn) |
| `BACKUP_*`, `PG_IMAGE` | Điền ở [bước 12](#bước-12-cài-sao-lưu) |

Host trong `DATABASE_URL` là tên container Postgres trên `POSTGRES_NETWORK` (ở bước 6 là `postgres`), không phải `localhost`.

Kiểm tra:

```bash
docker compose config --quiet && echo OK
```

### Bước 11: Khởi động app

```bash
cd /opt/my-credit
docker compose pull
docker compose up -d
docker compose ps                 # STATUS chuyển sang (healthy) sau khoảng 30 giây
docker compose logs -f app        # thấy migration xong rồi server chạy; Ctrl+C để thoát
```

Healthcheck gọi `GET /api/health`, trả 200 khi truy vấn được DB. Traefik phát hiện container mới và xin chứng chỉ cho `APP_HOST`; xem bằng `docker logs traefik`.

Kiểm tra sau lần đầu:

1. Mở `http://<APP_HOST>`, phải tự chuyển sang `https://` với chứng chỉ hợp lệ.
2. Đăng ký tài khoản bố mẹ và tạo gia đình.
3. Đăng xuất rồi đăng nhập lại, tạo thử một rule, để chắc kiểm tra Origin của Server Actions không chặn nhầm request đi qua proxy.

### Bước 12: Cài sao lưu

`backup.sh` chạy `pg_dump -Fc` trong container `PG_IMAGE` trên network Postgres, mã hóa bằng `age` ngay trong luồng, ghi `BACKUP_DIR/my-credit-<thời điểm UTC>.dump.age` (quyền 600) và giữ `BACKUP_KEEP` bản mới nhất. Trên đĩa không có bản rõ.

Tạo cặp khóa trên **máy của bạn**, không phải VPS:

```bash
age-keygen -o my-credit-backup.key
# Public key: age1...
```

Cất `my-credit-backup.key` vào trình quản lý mật khẩu hoặc nơi an toàn ngoài VPS. Mất file này thì không giải mã được bản sao lưu nào. Chỉ đưa dòng `age1...` lên VPS.

Trên VPS:

```bash
cd /opt/my-credit && chmod 700 backup.sh
nano .env      # BACKUP_AGE_RECIPIENT=age1..., BACKUP_DIR, BACKUP_KEEP, PG_IMAGE
sudo mkdir -p /var/backups/my-credit && sudo chown deploy: /var/backups/my-credit
./backup.sh    # chạy thử, in ra "backup: đã ghi ..."
```

`PG_IMAGE` phải có major bằng hoặc mới hơn server Postgres (Postgres ở bước 6 là 16, nên `postgres:16-alpine`).

Cron hằng ngày lúc 3:15 (`crontab -e` của user `deploy`):

```cron
15 3 * * * /opt/my-credit/backup.sh /opt/my-credit/.env >> /home/deploy/my-credit-backup.log 2>&1
```

Nên định kỳ chép `/var/backups/my-credit` ra ngoài VPS (`rsync`, `rclone` sang máy khác hoặc object storage). File đã mã hóa nên chép đi đâu cũng an toàn. Nên thử [khôi phục](#khôi-phục-từ-bản-sao-lưu) ra một database phụ ít nhất một lần để chắc bản sao lưu dùng được.

---

## Phần D. Vận hành

### Cập nhật lên bản mới

```bash
cd /opt/my-credit
./backup.sh                               # sao lưu trước mỗi lần cập nhật
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v0.2.0/' .env
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=50 app         # xem migration chạy xong
```

### Rollback

Đặt lại `IMAGE_TAG` về tag cũ rồi chạy lại:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v0.1.0/' .env
docker compose up -d
```

Migration của dự án chỉ thêm (thêm cột, thêm bảng), không đổi tên hay xóa trong cùng một bản phát hành, nên image cũ vẫn chạy được trên schema mới. Chỉ khi một bản phát hành có migration không tương thích ngược mới cần [khôi phục DB](#khôi-phục-từ-bản-sao-lưu) trước khi chạy image cũ.

### Khôi phục từ bản sao lưu

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

### Việc vận hành thường gặp

Đặt lại mật khẩu bố mẹ (in mật khẩu tạm ra màn hình và hủy mọi phiên đăng nhập của tài khoản đó):

```bash
cd /opt/my-credit
docker compose exec app node scripts/reset-password.js <email>
```

Xem log:

```bash
docker compose logs -f --tail=100 app     # app
docker logs -f --tail=100 traefik         # Traefik (chứng chỉ, định tuyến)
docker logs -f --tail=100 postgres        # Postgres
```

Log container xoay vòng theo cấu hình `logging` trong từng `compose.yaml`. Đổi mức log của app bằng `LOG_LEVEL` trong `.env` rồi `docker compose up -d`.

Cập nhật Traefik hoặc Postgres (bản vá cùng major):

```bash
cd /opt/traefik   # hoặc /opt/postgres
docker compose pull && docker compose up -d
```

Nâng **major** của Postgres (ví dụ 16 lên 17) không làm được bằng cách đổi tag image: dữ liệu cũ không đọc được. Phải dump, dựng server mới, rồi restore.

Dọn image cũ cho đỡ tốn đĩa (giữ lại image đang dùng):

```bash
docker image prune -a --filter "until=720h"
```

### Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| `docker compose config` báo `Đặt ... trong .env` | Thiếu biến bắt buộc | Điền biến đó trong `.env` |
| `permission denied ... docker.sock` | User chưa vào nhóm `docker` hoặc chưa đăng nhập lại | [Bước 4](#bước-4-cài-docker), đăng xuất rồi đăng nhập lại |
| `pull access denied` / `denied` khi pull | Package riêng tư chưa đăng nhập GHCR, hoặc `GHCR_OWNER` có chữ hoa | Xem phần package riêng tư ở [bước 8](#bước-8-phát-hành-image-trên-github); viết thường `GHCR_OWNER` |
| `network ... declared as external, but could not be found` | Chưa tạo network hoặc sai tên | [Bước 5](#bước-5-tạo-docker-network-dùng-chung); đối chiếu với `docker network ls` |
| Container app khởi động lại liên tục, log có lỗi migration | Không kết nối được DB, sai mật khẩu, hoặc migration lỗi | `docker compose logs app`; kiểm tra host, mật khẩu trong `DATABASE_URL` và Postgres có trên `POSTGRES_NETWORK` |
| `ECONNREFUSED` / `getaddrinfo ENOTFOUND` tới DB | Host trong `DATABASE_URL` là `localhost` hoặc sai tên container | Dùng tên container Postgres trên network chung |
| `password authentication failed for user "my_credit"` | Mật khẩu trong `.env` khác lúc tạo role | `ALTER ROLE my_credit PASSWORD '...'` trong psql, hoặc sửa `.env` |
| App `(unhealthy)` | App chạy nhưng `/api/health` không truy vấn được DB | Xem log; `docker compose exec app wget -qO- http://127.0.0.1:3000/api/health` |
| Traefik log `client version ... is too old` | Traefik cũ không hợp Docker Engine mới | Dùng Traefik v3.6.1 trở lên |
| Traefik trả `404 page not found` | Sai `APP_HOST`, sai entrypoint, app chưa `healthy`, hoặc Traefik không thấy container | Kiểm tra `APP_HOST`, `TRAEFIK_ENTRYPOINT`, `docker compose ps`, log Traefik |
| Chứng chỉ không hợp lệ (`TRAEFIK DEFAULT CERT`) | DNS chưa trỏ về VPS, port 80 bị chặn, sai `TRAEFIK_CERTRESOLVER`, hoặc `acme.json` sai quyền | Kiểm tra DNS, `ufw status`, `chmod 600 acme.json`, log ACME của Traefik |
| Mở được trang nhưng đăng nhập/gửi form báo lỗi; log app có dòng `` `x-forwarded-host` header with value ... does not match `origin` `` | Proxy đổi `Host`/`X-Forwarded-Host` (ví dụ thêm một lớp proxy viết lại host, hoặc cấu hình Traefik `passHostHeader: false`) nên không khớp `Origin` | Sửa proxy để giữ nguyên host gốc (Traefik mặc định đã giữ) |
| Link mời bố mẹ trỏ sai domain hoặc thiếu domain | `APP_URL` trong `.env` sai hoặc trống | Sửa `APP_URL` trong `.env` rồi `docker compose up -d` |
| Đăng nhập xong vẫn bị đá ra | Truy cập qua HTTP; cookie có cờ `Secure` | Luôn vào bằng `https://` |
