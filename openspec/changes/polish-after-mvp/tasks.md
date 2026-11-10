# Tasks

## 1. Phiên bố mẹ trên máy của con (family-accounts)

- [x] 1.1 Thêm cột `sessions.ttl_ms` (migration `0006`), cho `createSession` ghi thời hạn riêng và `resolveSession` dùng thứ tự `opts.ttlMs` → `row.ttlMs` → mặc định (design D1). Kiểm tra bằng unit test: phiên có `ttl_ms` 15 phút hết hạn sau 15 phút không dùng, được gia hạn khi còn dùng; phiên `ttl_ms` null vẫn sống 30 ngày
- [x] 1.2 `loginAction` và `registerAction` kiểm tra phiên thiết bị còn hiệu lực rồi tạo phiên bố mẹ với `PARENT_ON_FAMILY_DEVICE_TTL_MS` (design D2). Kiểm tra bằng unit test hoặc e2e: đăng nhập trên máy đã bật chế độ gia đình thì phiên có `ttl_ms` 15 phút; trên máy thường hoặc với cookie `mc_device` giả thì `ttl_ms` null

## 2. Lịch sử phía con (currency-ledger)

- [x] 2.1 Tách `parseHistoryParams` và component `HistoryFilters` (tham số `showChild`) từ trang lịch sử bố mẹ sang `src/ui/history-list.tsx`; trang bố mẹ dùng lại, hành vi không đổi (design D3). Kiểm tra bằng unit test cho `parseHistoryParams` (loại sai, ngày sai, `from` sau `to`) và e2e lịch sử bố mẹ hiện có vẫn xanh
- [x] 2.2 Trang lịch sử phía con nhận `searchParams`, hiện `HistoryFilters` không có ô chọn con, luôn lọc theo con của phiên; "Xem thêm" giữ bộ lọc. Kiểm tra bằng e2e: con lọc theo loại và khoảng ngày thấy đúng giao dịch; thêm `child=<id con khác>` trên URL không lộ giao dịch của con khác

## 3. Danh sách nhiệm vụ trên màn hình hẹp (ui-theme)

- [x] 3.1 Tách `useTaskActions` và `TaskActionButtons` từ `TaskRow`, thêm `TaskCard`; trang render bảng `hidden md:block` và danh sách thẻ `md:hidden` (design D4). Kiểm tra bằng e2e ở 360px: thấy thẻ có đủ thông tin, bấm "Sửa" lưu được, bấm "Tạm dừng" đổi trạng thái, trang không cuộn ngang; ở 1280px vẫn là bảng

## 4. Trang cài đặt (sửa lỗi)

- [x] 4.1 Tái hiện cảnh báo `Date.now()` ở `/parent/settings` trên bản build, tìm chỗ gọi từ stack trace và sửa theo design D5. Kiểm tra bằng e2e chạy với `E2E_PROD=1`: mở trang cài đặt rồi log server không có chuỗi "unstable value"
- [x] 4.2 Định dạng ngày bật và ngày hết hạn của thiết bị ở server theo múi giờ của gia đình, truyền chuỗi đã định dạng cho component client. Kiểm tra bằng unit test hàm định dạng với múi giờ khác múi giờ máy chạy test

## 4b. Cookie bố mẹ sau khi bật chế độ gia đình (sửa lỗi)

- [x] 4b.1 `src/proxy.ts` chỉ gia hạn cookie phiên ở request tải trang (`Sec-Fetch-Mode: navigate`), bỏ qua request RSC và prefetch, để request chạy dở không ghi lại cookie `mc_parent` vừa bị xóa (design D6). Kiểm tra bằng unit test proxy (request chạy ngầm không đặt cookie, request tải trang vẫn đặt) và chạy lặp e2e `action-authz` với `E2E_PROD=1` không còn lỗi

## 5. Kiểm tra tổng

- [ ] 5.1 Chạy lint, `tsc`, `npm test`, e2e ở dev và `E2E_PROD=1`; tất cả xanh

## Workflow follow-up

- Archive change sau khi anh duyệt kết quả và CI xanh.
