# Proposal

## Why

Review độc lập change `add-family-credit-mvp` (ngày 2026-11-09) tìm ra các lỗi mức cao và trung bình; những lỗi này đã được sửa trước khi archive. Còn lại một nhóm lỗi mức thấp và chỗ thiếu test. Các lỗi này không làm sai số dư, nhưng làm lệch spec ở vài chỗ hiển thị, để lại cửa sổ race hẹp, và làm CI chưa kiểm tra đúng bản chạy production. Nên dọn hết trước khi gia đình bắt đầu dùng thật.

## What Changes

**Hồ sơ con đã lưu trữ**
- Không ghi được điểm mới (áp dụng rule, thưởng/phạt đột xuất) cho con đã lưu trữ.
- Yêu cầu con đã gửi trước khi bị lưu trữ (khai rule, báo xong nhiệm vụ, đổi thưởng) vẫn duyệt hoặc từ chối được, khớp với cách đã sửa cho nhiệm vụ hằng ngày.
- Hàng chờ duyệt ghi rõ tên con kèm nhãn "đã lưu trữ".
- Nhiệm vụ nhóm vẫn hiện tên người báo xong dù người đó đã bị lưu trữ.

**Lịch sử giao dịch**
- Có phân trang "Xem thêm" cho cả bố mẹ và con, thay cho việc cắt im lặng ở 200 hoặc 100 dòng.
- Tên đơn vị tiền tệ hiện trên từng dòng, không chỉ nằm trong `sr-only`.

**Chuông thông báo**
- Thông báo bị trừ điểm hiện mức thực trừ, không hiện mức gốc.
- Số chưa đọc khớp với danh sách 30 ngày.
- Giờ hiển thị theo múi giờ của gia đình.

**Màn phản hồi điểm**
- Thông báo mới đến trong lúc con đang xem một màn thì không thay màn đó giữa chừng, và không phát lại âm của màn đã phát.

**Âm thanh**
- Phía bố mẹ có nút loa theo từng thiết bị, như phía con.

**Mục tiêu tiết kiệm**
- Thanh tiến độ làm tròn giống phần trăm hiển thị.
- Màn chính của con có nút "Đổi" nổi bật khi đạt mục tiêu.
- `setGoal` chạy trong transaction có khóa, để không chọn được phần thưởng vừa bị ẩn.

**Tương phản**
- Bỏ `opacity` làm chữ dưới 4.5:1: thẻ rule hoặc phần thưởng đang ẩn, và dòng "Con đang có" trên màn chính.

**Nhiệm vụ nhóm**
- Con báo xong sau người khác trong cùng lúc không còn thấy lỗi "đã hoàn thành" sai.

**Bảo mật và vận hành**
- Job dọn dẹp xóa phiên hết hạn.
- Bật lại chế độ gia đình thì thay phiên thiết bị cũ của chính thiết bị đó, không tạo thêm phiên mồ côi.
- Đăng nhập PIN xóa phiên con cũ.
- Ghi log `authz_denied` khi truy cập dữ liệu của gia đình khác.

**CI và đóng gói**
- E2e chạy trên bản build production để kiểm tra đúng CSP và HSTS.
- CI chạy thử image vừa build: migration, `/api/health` và `reset-password.js`.
- Dependabot cập nhật được image Node: bỏ `ARG` trong `FROM`, hoặc ghim digest.

**Test bổ sung**
- Race trên Postgres thật: hai lần duyệt đổi thưởng đồng thời; duyệt đổi thưởng song song với phạt; hai bố mẹ duyệt cùng một yêu cầu khai rule hoặc cùng một nhiệm vụ.
- Phân quyền ở tầng Server Action: phiên con gọi action của bố mẹ.

**Ngoài phạm vi**
- Giới hạn thời gian của phiên bố mẹ đăng nhập lại trên thiết bị chế độ gia đình (để quyết định sau khi dùng thật).
- Bộ lọc ngày và loại cho lịch sử phía con.

**Giả định (có thể chỉnh khi review)**
- Con đã lưu trữ: yêu cầu gửi trước khi lưu trữ vẫn được duyệt; bố mẹ vẫn ghi được giao dịch điều chỉnh để sửa sai; còn thưởng/phạt mới thì bị chặn.
- Giới hạn 10 lời mời mỗi ngày giữ cửa sổ 24 giờ theo UTC. Đây là chi tiết chống spam, không cần theo ngày của gia đình; chỉ thêm test.

## Capabilities

### New Capabilities

### Modified Capabilities
- `family-accounts`: requirement "Quản lý hồ sơ con" thêm hành vi với con đã lưu trữ (không ghi điểm mới, yêu cầu cũ vẫn duyệt được).
- `currency-ledger`: requirement "Xem lịch sử giao dịch" thêm phân trang, không cắt lịch sử mà không báo.
- `kid-notifications`: requirement "Chuông thông báo của con" thêm số chưa đọc khớp danh sách, mức thực trừ và giờ theo múi giờ gia đình.
- `ui-theme`: requirement "Thứ tự hiển thị phản hồi điểm" thêm hành vi khi thông báo mới đến lúc con đang xem một màn.

## Impact

- **Domain:**
  - `src/server/domain/`: `ledger.ts`, `rule-claims.ts`, `shop.ts`, `notifications.ts`, `daily-tasks.ts`.
  - `src/server/auth/`: `family-mode.ts`, `sessions.ts`.
  - `src/server/maintenance.ts`.
- **Giao diện:**
  - Lịch sử: `src/ui/history-list.tsx`, `src/app/parent/history`, `src/app/kid/(app)/history`.
  - Phía con: chuông, `kid-notifications.tsx`, `home/page.tsx`, `today-tasks.tsx`.
  - Phía bố mẹ: `src/app/parent/layout.tsx`, `src/app/parent/shop`, `src/app/parent/rules`.
  - Thành phần chung: `src/ui/primitives.tsx`.
- **CI và đóng gói:** `.github/workflows/ci.yml`, `playwright.config.ts`, `Dockerfile`, `.github/dependabot.yml`.
- **DB:** không thêm migration mới, trừ khi cần index cho việc dọn phiên.
