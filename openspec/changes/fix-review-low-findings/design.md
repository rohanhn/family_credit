# Design

## Context

Change `add-family-credit-mvp` đã archive (spec chính nằm ở `openspec/specs/`); các lỗi mức cao và trung bình của review đã được sửa ở các commit `ddc62a2`…`9402ca7`. Hai cách sửa trong số đó làm nền cho change này:
- `getDay` giữ con đã lưu trữ ở những ngày trước ngày lưu trữ. Trong chính ngày lưu trữ, nó vẫn giữ mục riêng con đã báo xong hoặc đã được duyệt.
- `src/proxy.ts` gia hạn cookie phiên khi có request GET.

Change này gồm nhiều sửa nhỏ, độc lập nhau. Mỗi nhóm có thể làm và commit riêng.

## Goals / Non-Goals

**Goals:**
- Đóng mọi lỗi mức thấp và các chỗ thiếu test còn lại trong review, kèm test tái hiện cho từng lỗi.
- Hành vi với con đã lưu trữ nhất quán giữa nhiệm vụ, khai rule, đổi thưởng và ghi điểm.
- CI kiểm tra đúng bản sẽ chạy production.

**Non-Goals:**
- Đổi mô hình phiên của bố mẹ trên thiết bị chế độ gia đình.
- Thêm bộ lọc cho lịch sử phía con.
- Đổi cửa sổ giới hạn lời mời sang ngày theo múi giờ của gia đình.

## Decisions

### D1. Con đã lưu trữ
- `recordTransaction` nhận cờ `allowArchived`. Mặc định cờ này tắt, và giao dịch bị từ chối (`INVALID_INPUT`, "Con đã được lưu trữ") nếu `lockChild` thấy `archivedAt`. Các đường được bật cờ:
  - duyệt nhiệm vụ (`approveTaskDay`);
  - duyệt khai rule;
  - duyệt đổi thưởng;
  - giao dịch điều chỉnh.
- Các đường bị chặn: `applyAction` (áp dụng rule, thưởng/phạt đột xuất).
- Như vậy quy tắc nằm ở một chỗ, trong cùng transaction có khóa dòng. Phương án thay thế là kiểm tra ở từng action; bị loại vì dễ sót.
- `listPendingClaims`, hàng chờ đổi thưởng và `listPendingTaskDays` trả thêm `childArchived` để giao diện gắn nhãn "đã lưu trữ".
- `today-tasks.tsx` tra tên người báo trong danh sách mọi con của gia đình, gồm cả con đã lưu trữ, thay vì chỉ trong `members`.

### D2. Phân trang lịch sử
- Phân trang theo con trỏ `beforeId`. `listTransactions` nhận `beforeId` và `limit`, rồi trả `{ rows, nextBeforeId }`.
- Hàm lấy `limit + 1` dòng để biết còn trang sau hay không.
- Trang lịch sử đặt `before=<id>` lên URL qua link "Xem thêm", nên giữ được bộ lọc và không cần JavaScript.
- Kích thước trang là 50.
- Chọn con trỏ thay vì offset vì sổ cái chỉ ghi thêm. Nếu dùng offset, một giao dịch mới chen vào sẽ làm trùng dòng giữa hai trang.

### D3. Hiển thị trong chuông và lịch sử
- `HistoryList` hiện tên đơn vị cạnh số điểm bằng chữ nhỏ `text-muted`, ví dụ "+10 Sao", thay cho `sr-only`.
- Chuông:
  - Thông báo `penalty` hiển thị `amount`. Giá trị này đã là mức thực trừ; hiện code đang ưu tiên `requestedAmount` thay vì nó. Màn báo trừ vẫn giữ dòng "Con chỉ còn đủ để trừ…".
  - `formatWhen` nhận `timezone` của gia đình, lấy từ layout con giống `points-feedback`.
- Số chưa đọc trong `getUnreadSummary` lọc `createdAt >= now - 30 ngày`, giống danh sách.
- `cleanupNotifications` xóa mọi thông báo quá 30 ngày, kể cả chưa đọc. Spec "Lưu giữ thông báo" cho phép việc này.

### D4. Hàng đợi màn phản hồi điểm
- `kid-notifications.tsx` giữ `current` (màn đang hiện, gồm danh sách id thông báo) trong state riêng.
- Khi lượt hỏi định kỳ trả về thông báo mới, `buildScreens` chỉ tính lại hàng đợi phía sau. `current` chỉ đổi khi con đóng màn, và việc đánh dấu đã đọc chỉ áp dụng cho id của màn đó.
- Âm thanh phát trong effect gắn với khóa của màn (ví dụ `kind + ids`), nên mount lại cùng một màn không phát lại.

### D5. Âm thanh phía bố mẹ
- Đưa `SoundToggle` vào header của `parent/layout.tsx`, dùng cùng khóa `localStorage` với phía con.
- Khóa này là theo thiết bị, không theo người dùng, nên khớp với "từng thiết bị".
- Lựa chọn của gia đình (`families.sound_enabled`) vẫn được ưu tiên như hiện tại.

### D6. Mục tiêu và tiến độ
- `ProgressBar` dùng `Math.floor`, giống `goalProgress`.
- Thêm một hàm `progressPercent` dùng chung cho cả hai chỗ, để không lệch nhau lần nữa.
- Màn chính của con: khi `reached`, hiện nút "Đổi" nổi bật. Nút gọi cùng action gửi yêu cầu đổi thưởng như ở Cửa hàng; nếu yêu cầu đang chờ duyệt thì nút hiện "Chờ duyệt".
- `setGoal` chạy trong `db.transaction`:
  1. Khóa dòng phần thưởng bằng `FOR SHARE`.
  2. Kiểm tra phần thưởng còn hiện.
  3. Cập nhật `children.goal_reward_id`.
- `setRewardHidden` cập nhật dòng phần thưởng, tức là lấy khóa ghi, nên hai thao tác này chạy lần lượt.

### D7. Tương phản khi dùng opacity
- Thẻ rule hoặc phần thưởng đang ẩn: bỏ `opacity-70`. Thay bằng nền `bg-soft`, viền nét đứt và nhãn "Đang ẩn". Màu chữ vẫn là token đã được test.
- "Con đang có": bỏ `opacity-90`.
- Thêm test lint đơn giản: tìm `opacity-` trên phần tử có chữ trong `src/app`, so với một danh sách cho phép (icon, trang trí), để lỗi này không quay lại.

### D8. Báo xong nhiệm vụ nhóm đồng thời
- Trong `reportDone`, khi upsert trả 0 dòng thì đọc lại dòng `task_days`:
  - nếu trạng thái là `pending`, trả mục đó như đã báo, giữ tên người báo đầu tiên;
  - chỉ khi trạng thái là `done` mới báo lỗi "đã hoàn thành".

### D9. Phiên và log bảo mật
- `runStartupMaintenance` gọi thêm `cleanupExpiredSessions`, xóa các phiên có `expires_at < now`.
- Thêm một lần chạy định kỳ mỗi 24 giờ trong `instrumentation.ts`, dùng `setInterval` với `unref`, để server chạy lâu vẫn được dọn.
- Thiết bị và phiên con:
  - `enableFamilyModeAction` đọc cookie `mc_device` hiện có và xóa phiên đó trước khi tạo phiên mới.
  - `kidPinLoginAction` xóa phiên con cũ, đọc từ cookie, trước khi đặt cookie mới.
- `authz_denied`:
  - Domain vẫn ném `notFound()` như hiện tại.
  - `fromError` trong `src/app/actions/result.ts` ghi `authz_denied` khi lỗi là `NOT_FOUND` và có phiên hợp lệ. Detail gồm tên action và id được yêu cầu, không gồm dữ liệu cá nhân.
  - Có thể ghi thừa khi mục bị xóa thật, nhưng ở quy mô gia đình thì chấp nhận được và đơn giản hơn nhiều so với phân biệt ở từng truy vấn.

### D10. CI và đóng gói
- `playwright.config.ts`: khi có `E2E_PROD=1`, chạy `next build && next start` thay cho `next dev`. CI đặt biến này.
- `security-headers.spec.ts`:
  - kiểm tra thêm HSTS và `upgrade-insecure-requests`, chỉ khi chạy với `E2E_PROD`;
  - kiểm tra CSP không có `'unsafe-eval'`.
- CI, job build image, trước bước push: chạy container với Postgres service, chờ healthcheck, gọi `/api/health`, rồi chạy `node scripts/reset-password.js` với một email đã seed. Bước này bắt được lỗi standalone thiếu module.
- `Dockerfile`: bỏ `ARG NODE_IMAGE` và ghi thẳng `FROM node:22-alpine@sha256:<digest>` ở cả ba stage, để Dependabot đọc và cập nhật được.

### D11. Test bổ sung
- `tests/db/` (Postgres thật):
  - hai lần duyệt đổi thưởng đồng thời: chỉ một lần trừ;
  - duyệt đổi thưởng song song với phạt: số dư không âm, đổi thưởng bị từ chối nếu không đủ;
  - hai bố mẹ duyệt cùng một yêu cầu khai rule;
  - hai bố mẹ duyệt cùng một nhiệm vụ trong ngày.
- E2e phân quyền: phiên con gửi POST tới Server Action của bố mẹ. Lấy action id từ trang bố mẹ trong một context khác, rồi gửi bằng cookie của con, và kiểm tra không có thay đổi.
- Unit test cho giới hạn lời mời: 10 lời mời trong 24 giờ, sang cửa sổ sau thì tạo được tiếp.

## Risks / Trade-offs

- [Chặn ghi điểm cho con đã lưu trữ có thể chặn nhầm luồng nào đó chưa bật cờ] → Test cho từng đường duyệt với con đã lưu trữ; cờ phải được bật rõ ràng ở chỗ gọi.
- [`next build` trong e2e làm CI chậm thêm khoảng 1–2 phút] → Chấp nhận, đổi lại kiểm tra được CSP production. Khi phát triển trên máy vẫn dùng `next dev`.
- [Ghim digest Node làm Dependabot mở PR thường xuyên hơn] → Đây chính là mục đích; CI có Trivy và e2e để bắt lỗi.
- [Ghi `authz_denied` theo `NOT_FOUND` có thể ra log thừa] → Log chỉ dùng để theo dõi, không dùng để cảnh báo tự động.
- [Gửi POST tới Server Action trong e2e phụ thuộc định dạng action id nội bộ của Next] → Nếu không ổn định, chuyển sang test tầng action bằng cách gọi trực tiếp hàm action với cookie giả trong Vitest.
