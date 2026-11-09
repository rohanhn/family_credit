# Design

## Context

Repo hiện chỉ có `openspec/` và `docs/`, chưa có code. Máy phát triển có Node 22 và npm 10. Các ràng buộc đã chốt khi explore (xem proposal.md): Next.js + SQLite, tự host, tự làm auth, một gia đình chỉ có một đơn vị tiền tệ, số dư không âm. Yêu cầu hành vi chi tiết nằm trong `specs/`.

Quy mô dự kiến: vài gia đình, mỗi gia đình vài người, nên lượng ghi rất thấp. SQLite với một tiến trình Node là đủ.

## Goals / Non-Goals

**Goals:**
- Một ứng dụng Next.js duy nhất, vừa là giao diện vừa là backend, chạy được bằng một lệnh và lưu trữ trong một file SQLite.
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

### D2. Lưu trữ: SQLite + better-sqlite3 + Drizzle ORM
- `better-sqlite3` chạy đồng bộ và nhanh. Mỗi nghiệp vụ ghi chạy trong một `db.transaction(...)` (BEGIN IMMEDIATE), nên việc kiểm tra số dư rồi ghi giao dịch là atomic.
- Drizzle cung cấp schema có kiểu và migration bằng `drizzle-kit`. Bật WAL mode và `foreign_keys = ON`.
- Đường dẫn file DB lấy từ biến môi trường `DATABASE_PATH` (mặc định `./data/app.db`, đã đưa vào `.gitignore`).
- *Thay thế*: Prisma. Bị loại vì engine nặng hơn và transaction tương tác với SQLite kém linh hoạt hơn.

### D3. Mô hình dữ liệu chính
```
families(id, name, currency_name, currency_icon, timezone, default_theme,
         sound_enabled DEFAULT 1)
parents(id, family_id?, email UNIQUE, password_hash)
invites(id, family_id, token_hash, expires_at, used_at)
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
            status[pending|approved|rejected|cancelled], reason)
transactions(id, family_id, child_id, kind[rule|task|adhoc|redeem|adjust],
             requested_amount, applied_amount, description,
             actor_parent_id, ref_type?, ref_id?, created_at)
notifications(id, child_id, kind[gift|penalty|rejected], title, amount?,
              reason?, transaction_id?, ref_type?, ref_id?, read_at?, created_at)
  -- index (child_id, read_at)
sessions(id_hash, subject_type[parent|device|child], subject_id, expires_at)
```
- **Sổ cái**: `transactions` chỉ có INSERT. Lớp domain không có hàm update hay delete; thêm trigger SQLite `BEFORE UPDATE/DELETE` để chặn ở tầng DB.
- **Số dư** = `SUM(applied_amount)` theo `child_id`, có index `(child_id)`. Ở quy mô này không cần cột số dư cache, nên tránh được sai lệch giữa hai nguồn.
- **Số dư không âm** (spec currency-ledger): trong transaction, `applied = max(requested, -currentBalance)` với khoản trừ; lưu cả `requested_amount` và `applied_amount`.
- **Tên và điểm của rule được chụp lại** vào `description`/`requested_amount` lúc áp dụng, nên sửa rule không ảnh hưởng lịch sử.
- **Hai kiểu nhiệm vụ** dùng chung bảng `tasks`, phân biệt bằng `mode`:
  - `individual`: mỗi con có dòng `task_days` riêng (`child_id` có giá trị). Nhiệm vụ "riêng cho một con" chính là `individual` với đúng một con được giao.
  - `group`: cả nhóm dùng chung một dòng `task_days` (`child_id IS NULL`); `reported_by_child_id` ghi ai đã báo.
  - SQLite coi các giá trị NULL là khác nhau trong UNIQUE, nên cần hai partial unique index riêng như trên.
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
- **Vitest** cho lớp domain, dùng SQLite in-memory: số dư không âm, sổ cái chỉ ghi thêm, chỉ cộng một lần mỗi nhiệm vụ mỗi ngày, duyệt đổi thưởng khi số dư đã giảm, phân quyền theo gia đình. Mỗi scenario trong specs nên ứng với ít nhất một test domain hoặc e2e.
- **Playwright** cho luồng chính (bố mẹ đăng ký → tạo con → con đăng nhập PIN → báo nhiệm vụ → bố mẹ duyệt → con đổi thưởng) và kiểm tra viewport 360px.

### D8. Triển khai tự host
- `next build` với `output: "standalone"`, chạy bằng `node server.js` dưới systemd, hoặc một Dockerfile mount volume `/data`. Migration chạy tự động khi khởi động.
- HTTPS do reverse proxy (Caddy hoặc nginx) đảm nhận.
- Sao lưu: script `scripts/backup.sh` dùng `sqlite3 app.db ".backup ..."`, chạy bằng cron hằng ngày; README hướng dẫn khôi phục.

## Risks / Trade-offs

- [PIN 4 số dễ đoán] → Khóa 5 phút sau 5 lần sai; đăng nhập PIN chỉ hoạt động trên thiết bị đã được bố mẹ bật chế độ gia đình.
- [Mất file SQLite là mất toàn bộ dữ liệu] → Bật WAL, chạy sao lưu hằng ngày, có tài liệu khôi phục.
- [Tính `SUM` mỗi lần đọc số dư có thể chậm khi sổ cái lớn] → Có index theo `child_id`; ở quy mô gia đình (hàng nghìn dòng) thì không đáng kể. Nếu cần, thêm bảng cache số dư sau.
- [Quên mật khẩu mà không có email reset] → Bố mẹ khác trong gia đình vẫn đăng nhập được; thêm lệnh CLI `npm run reset-password` cho người host.
- [Hình chibi cần tài nguyên đồ họa] → MVP dùng bộ SVG tối giản, tách khỏi code qua thư mục theme để thay thế sau mà không sửa logic.
- [Người dùng ở múi giờ khác thiết bị] → Ngày luôn tính theo múi giờ của gia đình, không theo múi giờ của trình duyệt.

## Migration Plan

Project mới nên không có dữ liệu cũ. Khởi chạy lần đầu sẽ tạo DB và chạy migration Drizzle. Rollback bằng cách dừng tiến trình, khôi phục file DB từ bản sao lưu và chạy lại bản build trước.

## Open Questions

- Bộ hình chibi chính thức. MVP dùng bộ SVG tự vẽ trong `docs/design/assets/`; có thể đặt vẽ bộ đẹp hơn sau và chỉ thay tài nguyên trong `public/`, không ảnh hưởng spec hay kiến trúc.
- Các màn chưa có mockup (lịch sử, danh sách rule, quản lý rule và cửa hàng, cài đặt, đăng ký/đăng nhập bố mẹ, màn khóa PIN) làm theo hệ thống trong `docs/design/README.md`; có thể bổ sung mockup trước khi code nếu cần chốt.
- Tên miền và máy chủ để host. Chỉ ảnh hưởng cấu hình deploy.
