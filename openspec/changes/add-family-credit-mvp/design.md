# Design

## Context

Repo hiện chỉ có `openspec/` và `docs/`, chưa có code. Máy phát triển có Node 22 và npm 10. Các ràng buộc đã chốt (xem proposal.md): Next.js + PostgreSQL, tự host, tự làm auth, một gia đình chỉ có một đơn vị tiền tệ, số dư không âm. Yêu cầu hành vi chi tiết nằm trong `specs/`.

Hạ tầng triển khai có sẵn: một VPS chạy nhiều app sau gateway **Traefik**, một server **PostgreSQL** dùng chung (mỗi app một database riêng), image build bằng CI và lưu trên **GHCR**. App này chạy ở `https://app3.domain.xyz`.

Quy mô dự kiến: vài gia đình, mỗi gia đình vài người, nên lượng ghi rất thấp. Một container Node là đủ.

## Goals / Non-Goals

**Goals:**
- Một ứng dụng Next.js duy nhất, vừa là giao diện vừa là backend, đóng gói thành một Docker image không giữ trạng thái; mọi dữ liệu nằm trong database PostgreSQL riêng của app.
- Logic nghiệp vụ (sổ cái, duyệt, quy tắc số dư) nằm trong lớp domain thuần TypeScript, test được mà không cần chạy UI.
- Mọi thao tác ghi điểm là atomic, không có race condition khi hai bố mẹ thao tác cùng lúc.

**Non-Goals:**
- Chạy nhiều instance hoặc scale ngang.
- Đăng nhập OAuth, quên mật khẩu qua email (MVP chưa gửi email; bố mẹ khác trong gia đình hoặc admin reset bằng CLI).
- Đồng bộ thời gian thực giữa các thiết bị (dữ liệu được làm mới khi chuyển trang hoặc khi người dùng thao tác). Ngoại lệ duy nhất: màn hình con hỏi lại số thông báo chưa đọc mỗi 30 giây (xem D3, "Thông báo").
- Push notification và email.
- Đa ngôn ngữ: giao diện chỉ có tiếng Việt.

## Decisions

### D1. Cấu trúc ứng dụng: Next.js App Router + Server Actions
- Một app Next.js (TypeScript, App Router) ở thư mục gốc repo. Thao tác ghi dùng Server Actions; trang dùng Server Components đọc trực tiếp từ lớp domain.
- Cấu trúc thư mục:
  ```
  src/
    app/
      (auth)/        đăng ký, đăng nhập, chấp nhận lời mời
      (parent)/      khu vực bố mẹ
      (kid)/         chọn avatar, màn hình con
    server/
      db/            schema, kết nối, migration
      auth/          session, băm mật khẩu và PIN, guard phân quyền
      domain/        ledger, rules, tasks, shop, family (logic thuần)
    ui/              component dùng chung, theme
  tests/
    domain/          unit test (Vitest)
    e2e/             Playwright
  ```
- *Thay thế đã cân nhắc*: tách API riêng (REST) và SPA. Bị loại vì gấp đôi code và cấu hình deploy mà không có lợi gì ở quy mô này.

### D2. Lưu trữ: PostgreSQL + Drizzle ORM
- Dùng server PostgreSQL có sẵn trên VPS. App có **database riêng** `my_credit` và **role riêng** `my_credit` (owner của database đó, không có quyền trên database của app khác). Chuỗi kết nối lấy từ biến môi trường `DATABASE_URL`. Driver `postgres` (postgres.js) qua `drizzle-orm/postgres-js`.
- **Atomic và chống race**: mỗi nghiệp vụ ghi chạy trong một `db.transaction(...)`. Trước khi đọc số dư, transaction khóa dòng của con bằng `SELECT … FROM children WHERE id = $1 FOR UPDATE`, nên mọi thao tác ghi điểm trên cùng một con (hai bố mẹ bấm cùng lúc, duyệt hai yêu cầu đổi thưởng liền nhau) chạy lần lượt. Mức cô lập mặc định READ COMMITTED là đủ khi đã có khóa này. Các chuyển trạng thái có điều kiện (`UPDATE … WHERE status = 'pending'`, kiểm tra số dòng bị ảnh hưởng) vẫn giữ để chống duyệt hai lần.
- **Pool nhỏ**: tối đa 5 kết nối (`DATABASE_POOL_MAX`), vì server Postgres dùng chung với các app khác.
- **Migration**: `drizzle-kit generate` sinh file SQL, commit vào `drizzle/`. Khi container khởi động, script `migrate` chạy migrator của Drizzle trong `pg_advisory_lock` (khóa theo hằng số của app) để hai container không chạy migration cùng lúc, rồi mới khởi động server. Migration hỏng thì container thoát với mã lỗi và Traefik không nhận traffic.
- **Kiểu dữ liệu**: khóa chính `bigint generated always as identity`; thời điểm `timestamptz`; ngày của nhiệm vụ `date`; cờ `boolean`; các giá trị liệt kê (`kind`, `status`, `mode`…) dùng `text` + `CHECK` thay vì enum của Postgres để migration dễ hơn.
- *Thay thế*: SQLite (lựa chọn ban đầu). Bị thay vì VPS đã có Postgres dùng chung với sao lưu và vận hành tập trung, và image không cần volume. Prisma bị loại vì engine nặng hơn và Drizzle đủ cho schema này.

### D3. Mô hình dữ liệu chính
```
families(id, name, currency_name, currency_icon, timezone, default_theme,
         sound_enabled DEFAULT true)
parents(id, family_id?, email UNIQUE, display_name, password_hash)
  -- display_name ("Bố", "Mẹ"…) hiện ở cột "người thực hiện" trong lịch sử
invites(id, family_id, created_by_parent_id, token_hash UNIQUE, expires_at,
        used_at?, used_by_parent_id?)
children(id, family_id, name, avatar, pin_hash, theme?, goal_reward_id?,
         archived_at, failed_pin_count, locked_until)
rules(id, family_id, name, kind[reward|penalty], points, icon, hidden)
rule_claims(id, child_id, rule_id, name_snapshot, points_snapshot, note?,
            status[pending|approved|rejected|cancelled], reason?,
            decided_by_parent_id?, created_at, decided_at?)
tasks(id, family_id, name, points, mode[individual|group], assign_all,
      weekdays_mask, effective_from, paused_from?)
task_assignees(task_id, child_id, effective_from, removed_from?)
task_days(id, task_id, child_id?, date, status[todo|pending|done],
          reported_by_child_id?, reject_reason)
  -- individual: UNIQUE(task_id, child_id, date)
  -- group:      UNIQUE(task_id, date) WHERE child_id IS NULL
rewards(id, family_id, name, price, icon, description, hidden)
redemptions(id, child_id, reward_id, price_snapshot,
            status[pending|approved|rejected|cancelled], reason,
            decided_by_parent_id?, created_at, decided_at?)
transactions(id, family_id, child_id, kind[rule|task|adhoc|redeem|adjust],
             requested_amount, applied_amount, description,
             actor_parent_id, ref_type?, ref_id?, created_at)
notifications(id, child_id, kind[gift|penalty|rejected], title, amount?,
              reason?, transaction_id?, ref_type?, ref_id?, read_at?, created_at)
  -- index (child_id, read_at)
sessions(id_hash, subject_type[parent|device|child], subject_id, expires_at)
auth_attempts(key, window_start, count)
  -- PRIMARY KEY (key, window_start); bộ đếm rate limit, xem D9
```
- Các bảng đều có `created_at`. Nguồn chuẩn của cột, CHECK và index là `src/server/db/schema.ts`; `transactions` có CHECK bảo đảm `applied_amount` cùng dấu và không vượt `requested_amount`.
- **Sổ cái**: `transactions` chỉ có INSERT. Lớp domain không có hàm update hay delete; thêm trigger PostgreSQL `BEFORE UPDATE OR DELETE ON transactions` gọi một hàm PL/pgSQL luôn `RAISE EXCEPTION`, để chặn ở tầng DB.
- **Số dư** = `SUM(applied_amount)` theo `child_id`, có index `(child_id)`. Ở quy mô này không cần cột số dư cache, nên tránh được sai lệch giữa hai nguồn.
- **Số dư không âm** (spec currency-ledger): trong transaction, `applied = max(requested, -currentBalance)` với khoản trừ; lưu cả `requested_amount` và `applied_amount`.
- **Tên và điểm của rule được chụp lại** vào `description`/`requested_amount` lúc áp dụng, nên sửa rule không ảnh hưởng lịch sử.
- **Hai kiểu nhiệm vụ** dùng chung bảng `tasks`, phân biệt bằng `mode`:
  - `individual`: mỗi con có dòng `task_days` riêng (`child_id` có giá trị). Nhiệm vụ "riêng cho một con" chính là `individual` với đúng một con được giao.
  - `group`: cả nhóm dùng chung một dòng `task_days` (`child_id IS NULL`); `reported_by_child_id` ghi ai đã báo.
  - PostgreSQL mặc định coi các giá trị NULL là khác nhau trong UNIQUE, nên cần hai partial unique index riêng như trên.
- **Con được giao trong một ngày** = nếu `assign_all` thì mọi con chưa lưu trữ, ngược lại thì các dòng `task_assignees` còn hiệu lực trong ngày đó (`effective_from <= date < removed_from`), sau đó loại các con đã lưu trữ. Đổi danh sách con được giao chỉ ghi `removed_from` hoặc thêm dòng mới với `effective_from` là ngày hôm sau, nên lịch sử các ngày cũ không đổi.
- **Mỗi nhiệm vụ mỗi ngày chỉ cộng một lần**: bảo đảm bằng các unique index trên, cộng với chuyển trạng thái `pending/todo → done` có điều kiện trong cùng transaction với việc ghi giao dịch.
- **Duyệt nhiệm vụ nhóm**: trong một transaction, chuyển dòng `task_days` của nhóm sang `done`, rồi ghi một giao dịch `+points` loại `task` cho mỗi con bố mẹ chọn, với `ref_type=task_day`. Danh sách con được chọn phải là tập con của danh sách được giao trong ngày đó và không được rỗng.
- **Khai rule thưởng** (`rule_claims`): con chỉ tạo được claim cho rule `kind=reward` đang hiện; tên và điểm được chụp lại lúc khai. Duyệt là chuyển trạng thái có điều kiện `pending → approved` (`UPDATE … WHERE status='pending'`, kiểm tra số dòng bị ảnh hưởng), ghi giao dịch `kind=rule` theo `points_snapshot` với `ref_type=rule_claim`, tất cả trong một transaction, nên không duyệt hai lần được. Hàng chờ duyệt của bố mẹ gộp ba nguồn: `task_days` đang chờ, `rule_claims` đang chờ, `redemptions` đang chờ.
- **Thông báo**: một hàm domain `notifyChild(tx, …)` được gọi **trong cùng transaction** với mọi thao tác ghi giao dịch (`kind` theo dấu của `applied_amount`: dương thì `gift`, âm hoặc phạt có mức thực trừ 0 thì `penalty`) và với mọi thao tác từ chối (`rejected`, kèm lý do). Riêng duyệt đổi thưởng tạo thông báo `gift` ("nhận quà") dù số điểm là âm. Nhờ vậy không có giao dịch nào thiếu thông báo. Thông báo không phải sổ cái: được đánh dấu đọc, và job dọn dẹp lúc khởi động xóa thông báo đã đọc quá 30 ngày.
- **Cập nhật khi đang mở app**: layout khu vực con có client component gọi Server Action `getUnreadSummary()` mỗi 30 giây (dừng khi tab ẩn, gọi lại khi tab hiện), trả về số chưa đọc và danh sách thông báo chưa đọc. Ở quy mô gia đình, cách hỏi định kỳ này đủ dùng mà không cần WebSocket hay SSE.
- **`task_days` tạo lười**: dòng được tạo khi con báo xong hoặc bố mẹ đánh dấu. Danh sách "hôm nay" được tính từ `tasks` (theo weekdays_mask, effective_from, paused_from và danh sách con được giao) rồi ghép với `task_days`, nên không cần cron.

### D4. Auth tự làm
- **Bố mẹ**: băm mật khẩu bằng argon2id (`@node-rs/argon2`). Session dùng token ngẫu nhiên 32 byte, cookie `httpOnly` + `SameSite=Lax` + `Secure` (khi chạy production), trong DB chỉ lưu SHA-256 của token. Hạn 30 ngày, kéo dài khi còn dùng.
- **Chế độ gia đình**: bố mẹ bật thì thiết bị nhận một cookie `device` (subject_type=device, gắn family_id, hạn 90 ngày). Cookie này chỉ cho phép xem màn hình chọn avatar và đăng nhập PIN. Bố mẹ có thể thu hồi thiết bị.
- **Con**: PIN được băm bằng argon2id. Đăng nhập đúng tạo session `child` ngắn hạn (2 giờ, gia hạn khi hoạt động), tồn tại song song với cookie `device`. Số lần nhập sai và thời điểm khóa lưu trên dòng `children`.
- **Guard**: mọi Server Action và truy vấn đi qua `requireParent()` / `requireChild()`, trả về `{familyId, …}`. Mọi truy vấn domain nhận `familyId` từ guard, không bao giờ lấy từ input. Truy cập sai gia đình trả về "không tìm thấy".
- Server Actions của Next.js đã có kiểm tra Origin để chống CSRF; không thêm GET nào có tác dụng ghi.
- *Thay thế*: Auth.js/Lucia. Bị loại vì luồng PIN theo thiết bị không khớp với mô hình của các thư viện này, còn phần tự làm thì nhỏ.

### D5. Thời gian và múi giờ
- Lưu thời điểm theo UTC. Ngày của nhiệm vụ là chuỗi `YYYY-MM-DD` tính theo `families.timezone` bằng `Intl.DateTimeFormat`, gom trong một hàm `familyToday(family, now)`. Đồng hồ được inject để test được.

### D6. Theme và UI
- **Nguồn chuẩn về giao diện**: `docs/design/README.md` (giá trị màu, chữ, bo góc, trạng thái thành phần) và mockup trong `docs/design/mockup/` (bố cục từng màn). Khi code và tài liệu lệch nhau, sửa theo tài liệu hoặc cập nhật tài liệu trước.
- Tailwind CSS. Màu theme là các CSS variable trên `[data-theme="<id>"]`, gồm 9 token: `bg`, `card`, `soft`, `ring`, `primary`, `on-primary`, `accent`, `ink`, `muted`; Tailwind map các token này thành màu (`bg-primary`, `text-muted`…). Năm theme: `sunny` (vàng/cam), `ocean` (xanh dương/ngọc), `candy` (hồng/tím), `robot` (trắng/xanh/đỏ/vàng, gợi ý cho bé trai), `magic` (hồng đậm/vàng kim, gợi ý cho bé gái). Con nào cũng chọn được mọi theme. Màu trạng thái (hoàn thành, chờ duyệt, thưởng, phạt) cố định, không đổi theo theme.
- Font: Baloo 2 cho tiêu đề và con số, Nunito cho nội dung; cả hai hỗ trợ tiếng Việt, tải bằng `next/font/google` (tự host khi build, không gọi Google lúc chạy).
- Hình chibi (avatar, icon tiền tệ, icon phần thưởng, linh vật theo theme) là SVG trong `public/themes/<id>/` và `public/avatars/`. MVP dùng bộ SVG tự vẽ trong `docs/design/assets/`; theme `robot` và `magic` có linh vật hiện trên thẻ số dư và màn ăn mừng. Đây là thiết kế gốc, không dùng nhân vật, tên hay biểu tượng của thương hiệu có bản quyền. Tác giả và giấy phép ghi trong `public/CREDITS.md`. Icon giao diện là SVG nét, không dùng emoji.
- Theme hiệu lực = `child.theme ?? family.default_theme`. Con chọn theme ở màn riêng có ảnh xem trước từng theme và lựa chọn "Dùng theme của gia đình".
- **Layout responsive** (mỗi màn là một trang, không tách bản điện thoại/web):
  - Khu vực con: dưới 768px dùng thanh tab dưới (Trang chính, Cửa hàng, Lịch sử, Rule); từ 768px dùng sidebar trái (thêm "Giao diện" và nút Thoát).
  - Khu vực bố mẹ: thanh menu trên cùng tự xuống dòng; nội dung chính và cột phụ (xem trước, giao dịch gần đây, form) nằm cạnh nhau trên màn rộng, xếp chồng trên màn hẹp.
  - Nội dung rộng tối đa khoảng 1200px, căn giữa. Bảng rộng cuộn ngang trong khung riêng.
- **Thông báo điểm mới**: khi màn hình con mở, hoặc khi lần hỏi định kỳ trả về thông báo mới, lấy các thông báo chưa đọc của con (D3). Nếu có thông báo `gift` thì hiện màn ăn mừng (tổng và danh sách từng khoản, confetti bằng `canvas-confetti`, bỏ qua khi `prefers-reduced-motion`); nếu có thông báo `penalty` (kể cả mức thực trừ 0 vẫn hiện mức gốc) thì hiện màn báo bị trừ, dùng nền theme, không confetti, kèm lời động viên. Thứ tự: cộng trước, trừ sau. Cả hai đều toàn màn hình dưới 768px, popup từ 768px. Thông báo `rejected` hiện sau cùng, kèm lý do, không có âm thưởng. Đóng màn nào thì đánh dấu đã đọc các thông báo của màn đó. Chuông ở thanh trên hiển thị số chưa đọc, mở ra là danh sách 30 ngày gần nhất.
- **Âm thanh**: module `src/ui/sfx.ts` tổng hợp 4 âm (`reward`, `penalty`, `pop`, `coin`) bằng Web Audio API, thông số theo `docs/design/README.md` §5; không dùng file âm thanh nên không cần giấy phép. Âm thanh phát khi `families.sound_enabled` bật **và** thiết bị không tắt (cờ trong `localStorage`, nút loa ở màn con). Một `AudioContext` dùng chung, tạo lười ở lần phát đầu; nếu trình duyệt chặn (chưa có thao tác người dùng) thì bỏ qua lặng lẽ và gọi `resume()` ở lần chạm sau. Mọi lỗi Web Audio đều được nuốt, không ảnh hưởng luồng nghiệp vụ. Phía bố mẹ, âm phát ở client sau khi Server Action ghi giao dịch thành công.
- **Tương phản**: mọi cặp chữ/nền đạt 4.5:1. Đã đo trên mockup: tất cả đạt, trừ chữ `primary` trên nền `soft` ở sunny (4.25) và ocean (4.27). Quy tắc: trên nền `soft`, `primary` chỉ dùng cho icon/viền (cần ≥ 3:1), chữ dùng `ink`. Unit test kiểm tra danh sách cặp chữ/nền được phép trong `docs/design/README.md` §2 cho từng theme.

### D7. Test
- **Vitest** cho lớp domain, dùng **PGlite** (`@electric-sql/pglite`, PostgreSQL chạy trong tiến trình test, không cần Docker) với cùng migration SQL như production; mỗi file test một instance sạch. Test chống race (hai giao dịch đồng thời trên cùng một con) chạy trên Postgres thật qua `DATABASE_URL_TEST`: ở máy dev là database `my_credit_test` trên container `shared-postgres`, trong CI là service container `postgres:16-alpine` (cùng major với Postgres dev). Các nhóm test chính: số dư không âm, sổ cái chỉ ghi thêm, chỉ cộng một lần mỗi nhiệm vụ mỗi ngày, duyệt đổi thưởng khi số dư đã giảm, phân quyền theo gia đình. Mỗi scenario trong specs nên ứng với ít nhất một test domain hoặc e2e.
- **Playwright** cho luồng chính (bố mẹ đăng ký → tạo con → con đăng nhập PIN → báo nhiệm vụ → bố mẹ duyệt → con đổi thưởng) và kiểm tra viewport 360px.

### D8. Triển khai: image build trên CI, VPS chỉ chạy, sau Traefik
- **CI (GitHub Actions, `.github/workflows/ci.yml`)**: khi push lên nhánh chính `master` hoặc tạo tag `v*`: cài đặt, lint, unit test (PGlite), e2e Playwright với service container Postgres, rồi build Docker image multi-stage và push lên `ghcr.io/<owner>/my-credit` với tag `sha-<short>`, `latest` (từ `master`) và `vX.Y.Z` (từ tag). Pull request chỉ chạy kiểm tra, không push image. Đăng nhập GHCR bằng `GITHUB_TOKEN` (quyền `packages: write`). Nền tảng build: `linux/amd64` (thêm `arm64` nếu VPS là ARM).
- **Image**: `next build` với `output: "standalone"`, base `node:22-alpine`, chạy bằng user không phải root, không có volume (app không giữ trạng thái). Entrypoint chạy migration (D2) rồi `node server.js`. Endpoint `GET /api/health` trả 200 khi truy vấn được DB, dùng cho `HEALTHCHECK` của Docker.
- **Trên VPS** (repo có mẫu `deploy/compose.yaml` và `deploy/.env.example`; VPS chỉ cần hai file này, không cần mã nguồn):
  - Image ghim theo tag phiên bản (`vX.Y.Z`), không dùng `latest` trên production.
  - Không publish port ra host. Container nối vào hai network ngoài (external) có sẵn: network của Traefik (`TRAEFIK_NETWORK`) và network của Postgres (`POSTGRES_NETWORK`); `DATABASE_URL` trỏ tới tên service Postgres trên network đó (ví dụ `postgres://my_credit:…@postgres:5432/my_credit`).
  - Labels Traefik:
    ```yaml
    traefik.enable: "true"
    traefik.docker.network: ${TRAEFIK_NETWORK}
    traefik.http.routers.my-credit.rule: Host(`app3.domain.xyz`)
    traefik.http.routers.my-credit.entrypoints: ${TRAEFIK_ENTRYPOINT:-websecure}
    traefik.http.routers.my-credit.tls.certresolver: ${TRAEFIK_CERTRESOLVER}
    traefik.http.services.my-credit.loadbalancer.server.port: "3000"
    ```
  - Biến môi trường: `DATABASE_URL`, `DATABASE_POOL_MAX` (mặc định 5), `APP_URL=https://app3.domain.xyz`, `NODE_ENV=production`, `PORT=3000`, `HOSTNAME=0.0.0.0`. Bí mật chỉ nằm trong `.env` trên VPS, không nằm trong image hay repo.
  - Package GHCR riêng tư thì VPS chạy `docker login ghcr.io` một lần bằng token chỉ có quyền `read:packages`.
- **Sau proxy**: HTTPS kết thúc ở Traefik, nên cookie luôn đặt `Secure` khi `NODE_ENV=production`. Cấu hình `experimental.serverActions.allowedOrigins` từ host của `APP_URL` để kiểm tra Origin của Server Actions không chặn nhầm request đi qua proxy.
- **Cập nhật (thủ công)**: đổi tag trong `.env` (`IMAGE_TAG`) rồi `docker compose pull && docker compose up -d`. Rollback: đặt lại tag cũ và `up -d`; nếu bản mới đã chạy migration không tương thích ngược thì khôi phục từ bản sao lưu. Migration nên viết theo kiểu chỉ thêm (thêm cột/bảng, không đổi tên hay xóa trong cùng một bản phát hành) để rollback image không cần khôi phục DB.
- **Khởi tạo lần đầu** (README): trên Postgres tạo `CREATE ROLE my_credit LOGIN PASSWORD '…'; CREATE DATABASE my_credit OWNER my_credit;`, tạo `.env`, `docker compose up -d`; migration tự tạo bảng.
- **Sao lưu**: `scripts/backup.sh` chạy trên VPS bằng cron hằng ngày: `docker run --rm --network $POSTGRES_NETWORK postgres:<major>-alpine pg_dump -Fc "$DATABASE_URL"`, mã hóa bằng `age` (D9) rồi ghi vào `BACKUP_DIR` (tên file kèm ngày), giữ 14 bản gần nhất. `<major>` phải cùng hoặc mới hơn phiên bản server Postgres. README hướng dẫn khôi phục bằng `pg_restore --clean --if-exists` và khuyên chép thư mục sao lưu ra ngoài VPS.
- **Công cụ quản trị**: `docker compose exec app node scripts/reset-password.js <email>` để đặt lại mật khẩu bố mẹ; script xóa mọi session của bố mẹ đó (D9).

### D9. Bảo mật vận hành
- **Rate limit** (spec family-accounts): bộ đếm cửa sổ cố định trong bảng `auth_attempts`, tăng bằng một câu `INSERT … ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1 RETURNING count`, nên đúng cả khi có nhiều request đồng thời và không cần Redis. Các khóa:
  - `login:email:<sha256(lower(email))>`: 5 lần sai liên tiếp thì khóa 15 phút; đăng nhập đúng thì xóa bộ đếm. Đếm cả email không tồn tại (vẫn chạy argon2 với một hash giả để thời gian phản hồi như nhau).
  - `login:ip:<ip>`: 20 lần trong 15 phút. `signup:ip:<ip>`: 5 lần mỗi giờ. `invite:family:<id>`: 10 lần mỗi ngày.
  - Khóa PIN của con giữ nguyên cơ chế trên dòng `children` (D4).
  - IP client lấy từ `X-Forwarded-For` do Traefik gắn (phần tử cuối). Chỉ tin header này vì container không publish port, mọi request đều qua Traefik.
  - Job dọn dẹp lúc khởi động xóa các dòng có cửa sổ đã quá 1 ngày.
  - Tùy chọn: thêm middleware `ratelimit` của Traefik (theo IP, cho toàn bộ app) làm lớp ngoài chống tràn request.
- **Header bảo mật**: đặt trong `headers()` của `next.config.ts` cho mọi đường dẫn:
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` (khi chạy dev thêm `'unsafe-eval'` cho script và bỏ `upgrade-insecure-requests`). Font tự host qua `next/font` nên không cần nguồn ngoài.
  - **Không dùng nonce**: theo tài liệu Next 16, CSP có nonce không dùng chung được với Partial Prerendering mà Cache Components bật (script trong khung tĩnh dựng sẵn không có nonce). Đã chọn giữ Cache Components/PPR và dùng CSP không nonce theo hướng dẫn chính thức. Chống XSS dựa vào việc React tự escape và quy tắc: không render HTML từ dữ liệu người dùng (`dangerouslySetInnerHTML` chỉ dùng cho CSS theme sinh từ hằng số). Có thể xem lại SRI (`experimental.sri`) khi tính năng này ổn định.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (chưa preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **Phiên khi đổi mật khẩu**: đổi mật khẩu xóa mọi `sessions` của bố mẹ đó trừ phiên hiện tại; reset bằng CLI xóa tất cả. Mật khẩu hiện tại được kiểm tra bằng argon2 và tính vào bộ đếm `login:email`.
- **Log sự kiện bảo mật**: `pino` ghi JSON ra stdout. Sự kiện: `login_failed`, `login_locked`, `signup_limited`, `pin_failed`, `pin_locked`, `device_enabled`, `device_revoked`, `password_changed`, `password_reset`, `invite_created`, `invite_accepted`, `authz_denied`. Mỗi dòng có thời điểm, sự kiện, `familyId`/`subjectId` nếu có, IP. Không bao giờ ghi mật khẩu, PIN, token hay cookie; email chỉ ghi dạng SHA-256. Trong compose đặt `logging: json-file` với `max-size: 10m`, `max-file: 5`.
- **Chuỗi cung ứng**: `.github/dependabot.yml` cho npm, GitHub Actions và Docker (hằng tuần). CI chạy `npm audit --omit=dev --audit-level=high` và Trivy quét image vừa build; có lỗ hổng HIGH/CRITICAL đã có bản vá thì không push image.
- **Sao lưu mã hóa**: `backup.sh` dẫn đầu ra `pg_dump` qua `age -r "$BACKUP_AGE_RECIPIENT"` (public key trong `.env` của VPS), file có đuôi `.dump.age`; trên đĩa không có bản rõ. Private key giữ ngoài VPS (máy của người quản trị hoặc trình quản lý mật khẩu); khôi phục bằng `age -d -i <key> file | pg_restore …`.

## Risks / Trade-offs

- [PIN 4 số dễ đoán] → Khóa 5 phút sau 5 lần sai; đăng nhập PIN chỉ hoạt động trên thiết bị đã được bố mẹ bật chế độ gia đình.
- [Mất dữ liệu khi Postgres hoặc VPS hỏng] → `pg_dump` hằng ngày, giữ 14 bản, khuyên chép ra ngoài VPS; README có hướng dẫn khôi phục.
- [Postgres dùng chung: app khác chiếm hết kết nối hoặc tài nguyên] → Pool nhỏ (5), role riêng chỉ có quyền trên database của app; `/api/health` báo lỗi để dễ phát hiện.
- [Image mới chạy migration hỏng] → Migration chạy trước khi server nhận traffic, lỗi thì container dừng; migration chỉ thêm, rollback bằng tag cũ.
- [Kiểm tra Origin của Server Actions sai khi đi qua proxy] → `allowedOrigins` lấy từ `APP_URL`; e2e trong CI chạy sau một reverse proxy giống production là không bắt buộc, nhưng cần kiểm tra thủ công sau lần deploy đầu.
- [Tính `SUM` mỗi lần đọc số dư có thể chậm khi sổ cái lớn] → Có index theo `child_id`; ở quy mô gia đình (hàng nghìn dòng) thì không đáng kể. Nếu cần, thêm bảng cache số dư sau.
- [Quên mật khẩu mà không có email reset] → Bố mẹ khác trong gia đình vẫn đăng nhập được; thêm lệnh CLI `npm run reset-password` cho người host.
- [Hình chibi cần tài nguyên đồ họa] → MVP dùng bộ SVG tối giản, tách khỏi code qua thư mục theme để thay thế sau mà không sửa logic.
- [Người dùng ở múi giờ khác thiết bị] → Ngày luôn tính theo múi giờ của gia đình, không theo múi giờ của trình duyệt.
- [Dò mật khẩu bố mẹ] → Khóa theo email sau 5 lần sai và giới hạn theo IP (D9); thông báo và thời gian phản hồi như nhau với email có hoặc không tồn tại.
- [Spam tài khoản và lời mời] → Giới hạn đăng ký theo IP và lời mời theo gia đình (D9).
- [Kẻ tấn công khóa tài khoản của người khác bằng cách cố ý đăng nhập sai] → Chấp nhận: khóa chỉ 15 phút và bố mẹ khác trong gia đình vẫn đăng nhập được; theo dõi qua log `login_locked`.
- [CSP không nonce cho phép script inline nên yếu hơn trước XSS] → React tự escape mọi nội dung; không render HTML từ dữ liệu người dùng; các lớp khác vẫn giữ (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`, cookie `httpOnly`). Xem lại khi Next hỗ trợ nonce cùng PPR hoặc SRI ổn định.
- [CSP chặn nhầm script của Next] → e2e chạy với header thật và kiểm tra console không có lỗi CSP.
- [Lộ file sao lưu chứa dữ liệu của trẻ] → Mã hóa bằng `age` trước khi ghi đĩa, private key không nằm trên VPS.

## Migration Plan

Project mới nên không có dữ liệu cũ. Lần đầu: tạo role và database `my_credit` trên Postgres có sẵn, rồi khởi động container; migration Drizzle tự tạo bảng. Rollback: đặt lại tag image trước đó và `docker compose up -d`; chỉ khi migration không tương thích ngược mới cần `pg_restore` từ bản sao lưu.

## Open Questions

- Bộ hình chibi chính thức. MVP dùng bộ SVG tự vẽ trong `docs/design/assets/`; có thể đặt vẽ bộ đẹp hơn sau và chỉ thay tài nguyên trong `public/`, không ảnh hưởng spec hay kiến trúc.
- Các màn chưa có mockup (lịch sử, danh sách rule, quản lý rule và cửa hàng, cài đặt, đăng ký/đăng nhập bố mẹ, màn khóa PIN) làm theo hệ thống trong `docs/design/README.md`; có thể bổ sung mockup trước khi code nếu cần chốt.
- Tên các network ngoài (Traefik, Postgres), tên entrypoint và certresolver của Traefik trên VPS: để làm biến trong `deploy/.env`, điền khi deploy.
- Phiên bản major của server Postgres trên VPS: quyết định image `pg_dump` trong `scripts/backup.sh`.
