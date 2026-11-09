# Tasks

## 1. Dữ liệu và phiên

- [x] 1.1 Viết migration thêm `sessions.device_child_id` (FK, có thể null, CHECK chỉ dùng cho `device`, có index) và `children.pin_changed_at` (design D1), rồi cập nhật `schema.ts`. Kiểm tra bằng `npm run db:migrate` trên DB dev và `tests/domain/db-setup.test.ts` pass
- [x] 1.2 `resolveSession` gia hạn phiên `device` của máy riêng. TTL phiên con trên máy riêng là 30 ngày, tự gia hạn (design D2). Kiểm tra bằng unit test với đồng hồ giả: máy riêng dùng đều sau 120 ngày vẫn còn hiệu lực; máy dùng chung hết hạn sau 90 ngày như cũ

## 2. Máy riêng của con (family-accounts)

- [x] 2.1 Viết `enablePersonalDevice` (design D3): kiểm tra con, xóa phiên bố mẹ và phiên thiết bị cũ của máy, tạo phiên `device` có `device_child_id`, ghi log `device_enabled` kèm kiểu thiết bị. Kiểm tra bằng unit test, gồm cả trường hợp con đã lưu trữ hoặc thuộc gia đình khác thì bị từ chối
- [x] 2.2 Sửa guard và đăng nhập trên máy riêng: `authenticateDevice` trả `childId`; `authenticateChild` kiểm tra khớp; `listKidsForDevice` chỉ trả con của máy; `loginChildWithPin` từ chối con khác mà không tăng bộ đếm sai PIN của con đó. Kiểm tra bằng unit test cho các scenario "Bật máy riêng" và "Con khác không đăng nhập được trên máy riêng"
- [x] 2.3 `archiveChild` thu hồi máy riêng của con đó; `listDevices` trả kiểu thiết bị và tên con. Kiểm tra bằng unit test cho scenario "Lưu trữ con có máy riêng" và "Danh sách thiết bị"
- [x] 2.4 Sửa giao diện bố mẹ: menu "Bật chế độ gia đình" có hai lựa chọn "Máy dùng chung" và "Máy riêng của…"; danh sách thiết bị trong Cài đặt ghi rõ kiểu. Kiểm tra thủ công: bật máy riêng của Bin rồi màn đăng nhập chỉ có Bin; thu hồi trong cài đặt thì máy về màn "Thiết bị chưa bật chế độ gia đình"

## 3. PIN mỗi lần mở trên máy riêng

- [x] 3.1 Đăng nhập PIN trên máy riêng đặt `mc_child` và `mc_child_mode=browser` không có `expires`; `src/proxy.ts` bỏ qua gia hạn khi có `mc_child_mode` (design D2). Kiểm tra bằng unit test cho proxy (không đặt lại `mc_child` khi có `mc_child_mode`) và cho action (cookie không có `expires`)
- [x] 3.2 Viết e2e: bật máy riêng, con đăng nhập, mở context mới chỉ mang cookie có `expires` (giả lập đóng trình duyệt) thì phải nhập PIN; trong cùng context, đi tới thời điểm hơn 2 giờ sau (đổi đồng hồ DB hoặc đặt `expires_at` trực tiếp) thì vẫn ở màn của con. Kiểm tra `npm run test:e2e` pass

## 4. Con đổi PIN

- [x] 4.1 Viết `changeChildPin` theo design D4, dùng chung bộ đếm khóa với đăng nhập PIN; `updateChild` ghi `pin_changed_at`; log `pin_changed` và `pin_reset` không chứa PIN. Kiểm tra bằng unit test cho mọi scenario của requirement "Con đổi PIN", gồm khóa sau 5 lần sai và phiên hiện tại vẫn giữ
- [x] 4.2 Làm trang `/kid/pin` (bàn phím số ba bước) và lối vào từ khu vực con; cài đặt bố mẹ hiện "PIN đổi lần cuối". Kiểm tra bằng e2e: con đổi PIN, thoát, đăng nhập bằng PIN cũ thất bại, PIN mới thành công; vùng bấm tối thiểu 44px ở 360px

## 5. Lối vào và PWA

- [x] 5.1 `src/proxy.ts` chuyển trang `/` theo cookie (design D5); `src/app/page.tsx` thêm link dự phòng. Kiểm tra bằng unit test proxy cho bốn trường hợp, và e2e mở `/` trên máy riêng chưa đăng nhập thì tới màn nhập PIN
- [x] 5.2 Thêm `src/app/manifest.ts`, icon 192/512/maskable và apple-icon (design D6); kiểm tra CSP không chặn manifest. Kiểm tra bằng e2e: `GET /manifest.webmanifest` trả JSON có `display: standalone` và các icon trả 200; Lighthouse/Chrome DevTools báo manifest hợp lệ (thủ công)

## 6. Tài liệu và tổng kiểm

- [ ] 6.1 Cập nhật README: cách bật máy riêng cho con, hành vi nhập PIN khi mở lại (kèm lưu ý trình duyệt khôi phục phiên), con đổi PIN và bố mẹ đặt lại PIN, cách "Thêm vào màn hình chính". Kiểm tra bằng cách làm theo README trên một điện thoại thật hoặc chế độ giả lập thiết bị
- [ ] 6.2 Chạy toàn bộ `npm run lint`, `npm test`, `npm run test:e2e` và `next build`. Kiểm tra tất cả pass

## Workflow follow-up

- Archive change bằng `/opsx:archive` sau khi review và mọi task đã xong.
