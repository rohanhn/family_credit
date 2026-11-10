# Tasks

## 1. Con đã lưu trữ (family-accounts)

- [x] 1.1 Thêm cờ `allowArchived` cho `recordTransaction` theo design D1, bật ở bốn chỗ: duyệt nhiệm vụ, duyệt khai rule, duyệt đổi thưởng, điều chỉnh. `applyAction` vẫn tắt cờ nên bị từ chối với con đã lưu trữ. Kiểm tra bằng unit test: áp dụng rule hoặc thưởng/phạt đột xuất bị từ chối và số dư không đổi; mỗi đường duyệt vẫn ghi được cho yêu cầu gửi trước khi lưu trữ
- [x] 1.2 Trả `childArchived` trong hàng chờ khai rule, đổi thưởng và nhiệm vụ, rồi hiện nhãn "đã lưu trữ" cạnh tên con trên hàng chờ của bố mẹ. `today-tasks.tsx` tra tên người báo trong mọi con của gia đình. Kiểm tra bằng unit test cho cờ, và kiểm tra thủ công nhãn trên trang `/parent`

## 2. Lịch sử giao dịch (currency-ledger)

- [x] 2.1 Phân trang `listTransactions` theo con trỏ `beforeId` (design D2, trang 50 dòng, trả `nextBeforeId`). Kiểm tra bằng unit test: 120 giao dịch qua 3 trang, không trùng, không thiếu; bộ lọc loại và ngày giữ nguyên qua các trang
- [ ] 2.2 Thêm link "Xem thêm" trên trang lịch sử của bố mẹ và của con, giữ tham số lọc trên URL. `HistoryList` hiện tên đơn vị tiền tệ cạnh số điểm, không để trong `sr-only`. Kiểm tra bằng e2e hoặc thủ công: tạo hơn 50 giao dịch thì thấy "Xem thêm" và trang 2; đổi tên đơn vị thì lịch sử cũ hiện tên mới

## 3. Chuông và màn phản hồi (kid-notifications, ui-theme)

- [ ] 3.1 Sửa ba chỗ trong chuông theo design D3: thông báo bị trừ hiện mức thực trừ; giờ theo múi giờ gia đình; số chưa đọc chỉ đếm 30 ngày. Thêm việc `cleanupNotifications` xóa mọi thông báo quá 30 ngày. Kiểm tra bằng unit test cho `getUnreadSummary`, `cleanupNotifications` và hàm định dạng giờ có múi giờ
- [ ] 3.2 Giữ màn phản hồi đang hiện khi có thông báo mới (design D4), và chỉ phát âm một lần cho mỗi màn. Kiểm tra bằng unit test cho logic hàng đợi (màn đang hiện không đổi khi danh sách thông báo cập nhật), và kiểm tra thủ công: đang xem màn bị trừ, bố mẹ duyệt quà thì màn bị trừ vẫn còn, đóng xong mới tới màn quà, âm phạt không phát lại

## 4. Âm thanh, mục tiêu và tương phản (ui-theme, reward-shop)

- [ ] 4.1 Đưa `SoundToggle` vào header phía bố mẹ (design D5). Kiểm tra thủ công: tắt loa ở phía bố mẹ rồi đăng nhập lại trên cùng thiết bị thì thao tác Thưởng/Phạt không phát âm, còn chữ "Đã ghi" vẫn hiện
- [ ] 4.2 Thêm hàm `progressPercent` dùng chung cho `ProgressBar` và `goalProgress` (làm tròn xuống). Thêm nút "Đổi" nổi bật trên màn chính của con khi đạt mục tiêu ("Chờ duyệt" nếu đã gửi yêu cầu). Kiểm tra bằng unit test 199/200 → 99%, và kiểm tra thủ công nút trên màn chính
- [ ] 4.3 `setGoal` chạy trong transaction có khóa phần thưởng (design D6). Kiểm tra bằng test race trên Postgres thật: chọn mục tiêu song song với ẩn phần thưởng thì không bao giờ còn `goal_reward_id` trỏ tới phần thưởng đang ẩn
- [ ] 4.4 Bỏ `opacity` trên chữ ở thẻ rule hoặc phần thưởng đang ẩn và dòng "Con đang có" (design D7). Thêm test quét `opacity-` trên phần tử có chữ, đối chiếu danh sách cho phép. Kiểm tra bằng test đó và test tương phản hiện có

## 5. Nhiệm vụ nhóm

- [ ] 5.1 `reportDone` đọc lại `task_days` khi upsert trả 0 dòng (design D8): đang chờ duyệt thì trả mục đó, không báo lỗi. Kiểm tra bằng test race trên Postgres thật: hai con báo xong cùng một nhiệm vụ nhóm đồng thời, cả hai đều thành công, chỉ có một dòng `pending`, tên người báo là con đến trước

## 6. Phiên và log bảo mật

- [ ] 6.1 Thêm `cleanupExpiredSessions` vào job dọn dẹp lúc khởi động và lần chạy định kỳ 24 giờ (design D9). Kiểm tra bằng unit test: phiên hết hạn bị xóa, phiên còn hạn giữ nguyên
- [ ] 6.2 Bật lại chế độ gia đình thì xóa phiên thiết bị cũ của chính thiết bị đó; đăng nhập PIN thì xóa phiên con cũ. Kiểm tra bằng unit test, và danh sách thiết bị trong cài đặt không tăng khi bật lại trên cùng thiết bị
- [ ] 6.3 Ghi `authz_denied` khi Server Action gặp `NOT_FOUND` lúc có phiên hợp lệ. Kiểm tra bằng unit test cho `fromError` với sink log giả

## 7. CI và đóng gói

- [ ] 7.1 Chạy e2e trên bản build production khi có `E2E_PROD=1`, và CI đặt biến này. Thêm kiểm tra HSTS, `upgrade-insecure-requests` và không có `'unsafe-eval'`. Kiểm tra bằng cách chạy `E2E_PROD=1 npm run test:e2e` pass trên máy
- [ ] 7.2 Thêm bước chạy thử image vào CI trước khi push: container cùng Postgres service, `/api/health` trả 200, `node scripts/reset-password.js` chạy được. Kiểm tra workflow xanh trên một PR
- [ ] 7.3 Bỏ `ARG NODE_IMAGE`, ghim `node:22-alpine@sha256:<digest>` ở mọi stage, và sửa README dòng nói về Dependabot nếu cần. Kiểm tra `docker build` thành công và `actionlint`/Dependabot config hợp lệ

## 8. Test bổ sung

- [ ] 8.1 Thêm test race trên Postgres thật (design D11): hai lần duyệt đổi thưởng đồng thời; duyệt đổi thưởng song song với phạt; hai bố mẹ duyệt cùng một khai rule; hai bố mẹ duyệt cùng một nhiệm vụ trong ngày. Kiểm tra `npx vitest run tests/db` pass
- [ ] 8.2 Thêm e2e phiên con gọi Server Action của bố mẹ, chuyển sang test tầng action nếu cách gửi POST không ổn định (design Risks). Thêm unit test giới hạn 10 lời mời mỗi 24 giờ. Kiểm tra toàn bộ `npm test`, `npm run lint` và `npm run test:e2e` pass

## Workflow follow-up

- Archive change bằng `/opsx:archive` sau khi review và mọi task đã xong.
