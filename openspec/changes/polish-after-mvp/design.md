# Design

## Context

- Phiên lưu trong bảng `sessions`:
  - thời hạn mặc định theo loại phiên nằm trong `SESSION_TTL_MS`: bố mẹ 30 ngày, thiết bị 90 ngày, con 2 giờ;
  - `resolveSession` gia hạn phiên trượt khi đã dùng hết hơn 10% thời hạn, dựa trên `opts.ttlMs` hoặc thời hạn mặc định của loại phiên;
  - phiên con trên máy riêng dùng `ttlMs` riêng nhưng truyền lúc gọi, không lưu trong DB.
- `src/proxy.ts` đặt lại hạn cookie `mc_parent` thành 30 ngày ở mỗi request GET. Hạn thật vẫn do DB quyết định.
- `loginAction` gọi `loginParent`, rồi đặt cookie `mc_parent`. Lúc này cookie `mc_device` (nếu có) vẫn còn: `enableFamilyMode` chỉ xóa phiên bố mẹ, không xóa phiên thiết bị.
- Lịch sử:
  - phía bố mẹ đã có form lọc GET (con, loại, từ ngày, đến ngày) và `HistoryPager` giữ tham số lọc;
  - phía con mới chỉ có phân trang.
- Bảng nhiệm vụ (`/parent/tasks`):
  - các ô thông tin render ở server; `TaskRow` (client) giữ cột thao tác và dòng form sửa;
  - bảng có `min-w-[560px]` trong khung `overflow-x-auto`, nên ở 360px phải cuộn ngang mới thấy nút.
- `/parent/settings`:
  - khi chạy e2e trên bản build, log có cảnh báo `Route "/parent/settings": Next.js encountered the unstable value Date.now() while prerendering`;
  - ngày của thiết bị được định dạng ở client bằng `toLocaleDateString("vi-VN")`, không truyền múi giờ.

## Goals / Non-Goals

**Goals:**
- Phiên bố mẹ trên máy của con ngắn và tự hết hạn khi bị bỏ quên. Phiên trên máy của bố mẹ không đổi.
- Lịch sử phía con lọc được giống phía bố mẹ, dùng chung một form lọc.
- Danh sách nhiệm vụ dùng được ở 360px mà không cuộn ngang.
- Log server sạch cảnh báo prerender ở trang cài đặt.

**Non-Goals:**
- Xác nhận lại mật khẩu trước thao tác nhạy cảm, hoặc nút "Khóa nhanh".
- Đổi thời hạn phiên con, phiên thiết bị.
- Chuyển các bảng khác sang dạng thẻ. Hiện chỉ trang nhiệm vụ có bảng nhiều cột.

## Decisions

### D1. Thời hạn riêng của từng phiên
- Thêm cột `sessions.ttl_ms` (integer, null được), qua migration `0006`.
  - Null thì dùng thời hạn mặc định của loại phiên, nên các phiên hiện có không đổi.
- `createSession(..., { ttlMs, persistTtl: true })` ghi `ttl_ms`.
- `resolveSession` lấy thời hạn theo thứ tự `opts.ttlMs`, rồi `row.ttlMs`, rồi `SESSION_TTL_MS`. Dùng thời hạn đó cho cả việc gia hạn lẫn ngưỡng 10%.
- Hằng số `PARENT_ON_FAMILY_DEVICE_TTL_MS = 15 * MINUTE` đặt trong `session-cookies.ts`.
- Phương án thay thế đã loại:
  - Truyền `ttlMs` ở mọi chỗ gọi `authenticateParent`, giống phiên con trên máy riêng. Bị loại vì chỗ gọi phải biết thiết bị có bật chế độ gia đình hay không, và dễ sót ở một guard nào đó.
  - Dùng cookie phiên trình duyệt. Bị loại vì bố mẹ hay để nguyên tab mở.

### D2. Nhận biết máy của con lúc đăng nhập
- `loginAction` và `registerAction` gọi `getDeviceAuth()`. Có phiên thiết bị còn hiệu lực (máy dùng chung hoặc máy riêng) thì tạo phiên bố mẹ với `PARENT_ON_FAMILY_DEVICE_TTL_MS`.
- Chỉ xét lúc đăng nhập. Nếu bố mẹ đăng nhập trước rồi mới bật chế độ gia đình, thì việc bật đã kết thúc phiên bố mẹ, như hiện tại.
- Cookie `mc_device` giả hoặc đã hết hạn không có phiên hợp lệ, nên phiên bố mẹ giữ 30 ngày. Như vậy không ai rút ngắn được phiên của bố mẹ trên máy khác.
- `src/proxy.ts` vẫn đặt hạn cookie 30 ngày. Phiên hết hạn trong DB thì guard chuyển về `/login`, nên cookie còn hạn không mở được gì.

### D3. Form lọc lịch sử dùng chung
- Tách form lọc ở `src/app/parent/history/page.tsx` thành component server `HistoryFilters` trong `src/ui/history-list.tsx`.
- Phần chuẩn hóa tham số (`kind`, `from`, `to`, `before`) tách thành hàm thuần `parseHistoryParams`, có unit test.
- Tham số `showChild`:
  - phía bố mẹ bật, có ô chọn con;
  - phía con tắt. Trang con luôn lọc theo `childId` của phiên và bỏ qua tham số `child` trên URL.
- Trang lịch sử phía con nhận `searchParams`. `HistoryPager` truyền `kind`, `from`, `to`, giống phía bố mẹ.

### D4. Danh sách nhiệm vụ dạng thẻ ở màn hình hẹp
- Trang render hai cách trình bày từ cùng dữ liệu:
  - bảng: `hidden md:block`;
  - danh sách thẻ: `md:hidden`.
  - Cách bị ẩn có `display: none`, nên không vào cây accessibility và không làm trùng nút khi dùng trình đọc màn hình hay khi e2e tìm theo role.
- Tách phần thao tác hiện nằm trong `TaskRow` thành `useTaskActions` (trạng thái sửa, tạm dừng, chạy lại) cùng component nút `TaskActionButtons`.
  - `TaskRow` (bảng) và `TaskCard` (thẻ) dùng chung hai phần này. Ở dạng thẻ, form sửa hiện ngay trong thẻ.
- Mốc 768px khớp với mốc đổi bố cục đã dùng ở khu vực con.

### D5. Cảnh báo prerender ở `/parent/settings`
- Tìm đúng chỗ gọi:
  - chạy `next build && next start`, đăng nhập rồi mở `/parent/settings`, đọc stack trace của cảnh báo;
  - các nơi đang nghi: `listDevices` (dùng `systemClock`) và component client định dạng ngày.
- Sửa theo hướng Next khuyến nghị:
  - với dữ liệu phụ thuộc thời điểm request ở server, gọi `await connection()` trước khi đọc giờ;
  - hoặc chuyển phần đó vào trong ranh giới `Suspense` đã đọc cookie.
- Kết quả khi làm (task 4.1):
  - Nguồn đã xác nhận bằng stack trace trên bản build của `master`: `requireParent` gọi `logSecurityEvent("authz_denied")` khi phiên bố mẹ không hợp lệ mà có cookie phiên con. Logger pino lấy giờ bằng `Date.now()`. Việc này xảy ra trong lượt prefetch `/parent/settings` lúc chạy (cookie đã có giá trị), nên chỉ thấy ở máy có phiên con, ví dụ e2e `action-authz`.
  - Cách sửa: các helper trong `src/server/auth/next.ts` gọi `await connection()` sau khi đọc cookie, trước khi kiểm tra phiên. Như vậy lượt prerender dừng trước mọi chỗ đọc giờ và không ghi nhầm `authz_denied`.
- Ngày bật và ngày hết hạn của thiết bị định dạng ở server bằng múi giờ của gia đình (`formatDate` hoặc `Intl` có `timeZone`), rồi truyền chuỗi đã định dạng cho component client.

### D6. Proxy chỉ gia hạn cookie ở request tải trang
- Hiện trạng: `src/proxy.ts` đặt lại cookie phiên ở mọi GET, kể cả request RSC và prefetch của client router.
  - Request như vậy xuất phát trước khi Server Action "bật chế độ gia đình" xóa `mc_parent`, nhưng trả về sau, sẽ ghi lại cookie.
  - Phiên trong DB đã bị xóa nên cookie không mở được gì, nhưng máy của con vẫn giữ cookie bố mẹ, và e2e `action-authz` lỗi lúc có lúc không (cả trên `master`).
- Quyết định: chỉ gia hạn ở request tải trang, nhận biết qua `Sec-Fetch-Mode: navigate`.
  - Next gỡ header `RSC`, `Next-Router-Prefetch` và tham số `_rsc` trước khi gọi proxy (`next/dist/server/web/adapter.js`), nên không dựa vào chúng được.
  - Request RSC và prefetch là `fetch()`, nên có `Sec-Fetch-Mode` khác `navigate`. Trình duyệt không gửi header này thì giữ hành vi cũ (vẫn gia hạn).
  - Trong một tab, request tải trang không chạy song song với Server Action, nên race không còn.
- Phương án thay thế đã loại:
  - Proxy đọc DB để kiểm tra phiên: proxy cố ý không đọc DB.
  - Bỏ hẳn việc gia hạn cookie: trình duyệt sẽ xóa cookie sớm hơn hạn trong DB với phiên đang được dùng.

## Risks / Trade-offs

- [15 phút có thể làm bố mẹ phải đăng nhập lại nhiều khi duyệt trên máy chung] → Mốc là một hằng số; đổi sau khi dùng thật. Mỗi thao tác đều gia hạn.
- [Gia hạn phiên ngắn ghi DB thường hơn: sau mỗi 1,5 phút có request] → Chỉ ảnh hưởng phiên bố mẹ trên máy của con, quy mô gia đình nên không đáng kể.
- [Render cả bảng lẫn thẻ làm trang lớn hơn một chút] → Số nhiệm vụ của một gia đình nhỏ; đổi lại không cần JavaScript để đổi cách trình bày.
- [Chưa rõ chắc nguồn của `Date.now()`] → Task đầu tiên của nhóm này là tái hiện và đọc stack trace; test e2e trên bản build kiểm tra log không còn cảnh báo.
- [Bố mẹ chỉ điều hướng trong app suốt 30 ngày mà không tải lại trang thì cookie hết hạn trước phiên trong DB] → Hiếm gặp; khi đó chỉ cần đăng nhập lại.
