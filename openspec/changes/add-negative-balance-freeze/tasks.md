# Tasks

## 1. Sổ cái cho phép số dư âm

- [x] 1.1 Sửa `appliedAmount` trong `src/server/domain/ledger.ts` để trả đúng mức gốc (design D1), cập nhật chú thích nhắc spec cũ; kiểm bằng test domain mới cho các scenario "Khoản trừ luôn ghi đủ" (phạt vượt số dư, phạt khi số dư 0, phạt khi đang nợ, thứ tự thưởng/phạt) trong `tests/domain/ledger.test.ts`
- [x] 1.2 Thêm test "Giao dịch cũ đã bị chặn": chèn trực tiếp một dòng có `requested -20`, `applied -5`, rồi kiểm số dư và lịch sử vẫn hiện mức gốc; kiểm bằng `npm test`
- [x] 1.3 Thêm test "Hoàn tác thưởng nhầm sau khi con đã tiêu hết" cho `recordAdjustment` (điều chỉnh ghi −10, số dư −10); kiểm bằng `npm test`
- [x] 1.4 Viết lại các test đang khẳng định số dư không âm trong `tests/domain/currency.test.ts`, `rules.test.ts`, `adhoc-proposals.test.ts`, `daily-tasks.test.ts`, `shop.test.ts`, `notification-screens.test.ts` theo scenario mới của `currency-ledger`, `reward-rules`, `kid-notifications`; kiểm bằng `npm test` không còn lỗi
- [x] 1.5 Viết lại `tests/db/ledger-race.test.ts` (hai khoản phạt song song trừ đủ, tổng −20 thay vì −10) và nhánh "Duyệt đổi thưởng song song với phạt" trong `tests/db/approval-race.test.ts` (số dư cuối bằng tổng giao dịch, đổi thưởng bị từ chối khi không đủ hoặc đóng băng); kiểm bằng lệnh test race trên Postgres thật như README hướng dẫn

## 2. Trạng thái nợ và mốc tan băng

- [x] 2.1 Tạo `src/lib/debt.ts` với `isInDebt`, `debtOf`, `thawProgress`, `tasksToThaw` và danh sách lời động viên chọn theo ngày (design D2, D9); kiểm bằng `tests/domain/debt.test.ts` phủ các scenario "Trạng thái nợ", "Thanh tan băng" (25%, mốc sâu thêm, vừa vào nợ) và "Động viên" (đủ, không đủ, không còn nhiệm vụ)
- [x] 2.2 Thêm `getDebtInfo(db, childId)` trong `ledger.ts` trả `{ balance, peakDebt }` bằng truy vấn cửa sổ (design D3); kiểm bằng test domain với các chuỗi giao dịch: phạt đầu tiên, nợ rồi trả một phần, nợ rồi hết nợ rồi nợ lại (mốc chỉ tính từ lần ≥ 0 gần nhất)

## 3. Đóng băng cửa hàng ở lớp domain

- [x] 3.1 Thêm mã lỗi `FROZEN` vào `src/server/domain/errors.ts` và thông điệp "Cửa hàng đang đóng băng" trong `shop.ts`; ánh xạ mã này trong các action ở `src/app/actions/shop.ts` để trả thông báo lỗi đúng; kiểm bằng `npm run lint` và `npx tsc --noEmit`
- [x] 3.2 `createRedemption` và `approveRedemption` ném `FROZEN` khi số dư < 0 sau khi khóa con (design D7); kiểm bằng test "Gửi yêu cầu khi đang nợ" và "Gửi lệnh duyệt khi đang nợ" (không có giao dịch, không có thông báo) trong `tests/domain/shop.test.ts`
- [x] 3.3 Chuyển `cancelRedemption` vào transaction có `lockChild`, ném `FROZEN` khi đang nợ; kiểm bằng test "Hủy yêu cầu khi đang nợ" (yêu cầu vẫn "chờ duyệt")
- [x] 3.4 `rejectRedemption` khóa con, ném `FROZEN` khi đang nợ và con chưa lưu trữ; kiểm bằng test "Gửi lệnh từ chối khi đang nợ" (không có thông báo "bị từ chối"), "Con đã lưu trữ đang nợ" (từ chối được, duyệt bị chặn), "Hết nợ thì xử lý lại được" và "Hết nợ nhưng chưa đủ điểm"
- [x] 3.5 `listPendingRedemptions` trả thêm cờ `frozen`; kiểm bằng test domain cho con đang nợ, con hết nợ và con đã lưu trữ đang nợ
- [x] 3.6 Thêm test mục tiêu khi đang nợ cho `goalProgress` (0%, còn thiếu 65) trong `tests/domain/shop.test.ts`; kiểm bằng `npm test`

## 4. Thông báo và màn tan băng

- [x] 4.1 Thêm `balanceAfter` vào truy vấn thông báo chưa đọc và danh sách chuông trong `src/server/domain/notifications.ts`, chuyển qua `NotificationItem` trong `src/app/actions/notifications.ts` (design D6); kiểm bằng test trong `tests/domain/notifications.test.ts` với chuỗi giao dịch có số dư lũy kế âm
- [x] 4.2 `buildScreens` nhận số dư hiện tại, đặt `thawed` và số nợ còn lại cho màn ăn mừng; kiểm bằng `tests/domain/notification-screens.test.ts` cho scenario "Tan băng", "Tan băng rồi lại bị phạt trước khi xem", "Trả được một phần nợ" và một màn chỉ có đổi thưởng (không bao giờ `thawed`)

## 5. Giao diện đóng băng

- [x] 5.1 Thêm `FROZEN_TOKENS`, CSS `[data-theme="frozen"]` trong `themeCss()` và hàm `displayTheme(theme, balance)` trong `src/ui/themes.ts`, không thêm vào `THEME_IDS` (design D4); kiểm bằng `tests/domain/theme-contrast.test.ts` chạy cùng các cặp màu cho bảng màu đóng băng và `tests/domain/themes.test.ts` khẳng định `isThemeId("frozen")` là sai và theme picker không có bảng màu này
- [x] 5.2 Thêm `mood="cold"` cho `ChibiAvatar` trong `src/ui/chibi.tsx`; kiểm bằng trang `/ui-demo` hiển thị đủ bốn nét mặt
- [x] 5.3 Truyền số dư vào `KidShell` từ layout khu vực con, dùng `displayTheme` cho `data-theme`, avatar `cold` và ẩn mascot khi đang nợ; overlay trong `KidNotificationsProvider` dùng cùng hàm; kiểm bằng chạy app với một con có số dư âm và thấy mọi trang của con dùng bảng màu băng, đổi theme vẫn lưu nhưng chưa áp dụng
- [x] 5.4 Trong `KidNotificationsProvider.apply`, gọi `router.refresh()` khi trạng thái nợ đổi, và khi đóng màn tan băng (design D5); kiểm bằng chạy app: phạt con thành nợ từ màn bố mẹ ở tab khác, trong vòng 30 giây màn của con chuyển sang đóng băng

## 6. Màn hình của con khi đang nợ

- [x] 6.1 Màn chính `src/app/kid/(app)/home/page.tsx`: ô số dư "Đang nợ X", thẻ tan băng thay thẻ mục tiêu, thẻ động viên với lối tắt tới nhiệm vụ còn làm được, rule thưởng và đề xuất xin thưởng (design D9); kiểm bằng chạy app ở 360px và 1280px với con nợ 15 có hai nhiệm vụ 10 điểm, thấy "Làm 2 nhiệm vụ hôm nay là tan băng rồi!"
- [x] 6.2 Cửa hàng `src/app/kid/(app)/shop/`: banner đóng băng kèm số nợ, thẻ phần thưởng ở trạng thái khóa thay nút "Đổi"/"Còn thiếu X", yêu cầu đang chờ hiện "đang đóng băng" và ẩn nút hủy, chọn mục tiêu vẫn hoạt động; kiểm bằng chạy app với con đang nợ có một yêu cầu đang chờ
- [x] 6.3 Màn phản hồi điểm `points-feedback.tsx`: màn bị trừ hiện "Con đang nợ X" kèm lời nhắc khi số dư < 0; màn ăn mừng hiện "Con còn nợ X nữa thôi" khi còn nợ và tiêu đề "Tan băng rồi!" khi `thawed`; kiểm bằng chạy app cho ba trường hợp: phạt thành nợ, cộng một phần nợ, cộng hết nợ

## 7. Màn hình của bố mẹ

- [x] 7.1 Trang tổng quan `src/app/parent/page.tsx`: thẻ con đang nợ hiện chip "đang nợ" và số nợ thay cho số âm; kiểm bằng chạy app với một con có số dư −15
- [x] 7.2 `apply/apply-panel.tsx`: thay cảnh báo "chỉ trừ được" bằng "Sau khi phạt, con sẽ nợ X" khi số dư dự kiến < 0, bỏ phép tính `Math.min` (design D8); kiểm bằng chạy app chọn rule phạt 20 cho con có 5 điểm
- [x] 7.3 `approval-queue.tsx` và `decision-form.tsx`: cảnh báo "Nếu duyệt, con sẽ nợ X" cho đề xuất tự nhận phạt; yêu cầu đổi thưởng có `frozen` hiện nhãn "Đang đóng băng: con đang nợ X" và khóa cả hai nút; kiểm bằng chạy app với con đang nợ có một yêu cầu đổi thưởng và một đề xuất tự nhận phạt, và với con đã lưu trữ đang nợ (nút từ chối vẫn bấm được)

## 8. Kiểm tra tích hợp

- [x] 8.1 Thêm e2e `tests/e2e/debt-freeze.spec.ts`: bố mẹ phạt con 20 khi con có 5 điểm (thấy "sẽ nợ 15"), con đăng nhập thấy màn bị trừ "Con đang nợ 15" rồi màn chính đóng băng, cửa hàng bị khóa, yêu cầu đang chờ không duyệt/từ chối được ở hàng chờ, bố mẹ duyệt nhiệm vụ +20, con thấy "Tan băng rồi!" và theme cũ trở lại; kiểm bằng `npx playwright test tests/e2e/debt-freeze.spec.ts`
- [x] 8.2 Chạy lại toàn bộ `npm test`, test race, `npm run lint`, `npx tsc --noEmit` và `npx playwright test`; kiểm bằng tất cả đều qua, gồm `tests/e2e/kid-goal.spec.ts`, `history-paging.spec.ts`, `kid-history-filter.spec.ts` đang dùng mức thực trừ
