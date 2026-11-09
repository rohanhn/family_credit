# Proposal

## Why

Hiện điện thoại riêng của con được xử lý như máy dùng chung của gia đình, nên có ba vấn đề:
- Máy của một con vẫn hiện avatar của anh chị em, và ai biết PIN của người khác thì đăng nhập được.
- Phiên con 2 giờ buộc con nhập lại PIN giữa chừng.
- Cứ 90 ngày bố mẹ phải cầm máy bật lại chế độ gia đình.

Ngoài ra con không tự đổi được PIN, và mở trang gốc `/` không có lối vào. Khi các con bắt đầu có điện thoại, cần một kiểu thiết bị riêng gắn với một con.

## What Changes

**Máy riêng của con**
- Bố mẹ đăng nhập trực tiếp trên điện thoại của con, rồi chọn bật "Máy riêng của <tên con>" (cạnh "Bật chế độ gia đình" như hiện nay).
- Máy riêng gắn với đúng một con: màn đăng nhập chỉ hiện con đó, con khác không đăng nhập được trên máy này.
- Như với chế độ gia đình, bật xong thì phiên bố mẹ trên máy đó kết thúc.

**PIN mỗi lần mở trên máy riêng**
- Phiên con trên máy riêng chỉ sống trong phiên trình duyệt hoặc app.
- Đóng hẳn trình duyệt hoặc app rồi mở lại thì phải nhập PIN. Chuyển qua app khác rồi quay lại thì không bị hỏi.
- Trong lúc trình duyệt còn mở, phiên không hết hạn sau 2 giờ như ở máy dùng chung.

**Phiên thiết bị máy riêng**
- Phiên thiết bị của máy riêng tự gia hạn khi còn dùng, nên bố mẹ không phải bật lại theo chu kỳ.
- Danh sách thiết bị trong Cài đặt ghi rõ "Máy riêng của Bin" hay "Máy dùng chung", và bố mẹ thu hồi được từng máy.
- Lưu trữ một con thì thu hồi máy riêng của con đó.

**Con tự đổi PIN**
- Trong khu vực của con có mục "Đổi PIN": nhập PIN cũ và PIN mới (nhập 2 lần).
- PIN mới áp dụng cho mọi thiết bị.
- Sai PIN cũ thì tính vào bộ đếm khóa 5 lần như khi đăng nhập.
- Bố mẹ vẫn đặt lại PIN được khi con quên.
- Mỗi lần đổi hay đặt lại PIN đều được ghi log bảo mật. Cài đặt của bố mẹ hiện "PIN đổi lần cuối".

**Lối vào ứng dụng**
- Trang `/` tự chuyển theo trạng thái của thiết bị:
  - có phiên con thì vào trang chính của con;
  - có máy riêng hoặc chế độ gia đình thì vào màn đăng nhập của con;
  - có phiên bố mẹ thì vào khu vực bố mẹ;
  - không có gì thì vào trang đăng nhập.

**Cài như ứng dụng (PWA)**
- Có web app manifest, icon và màu theme, để "Thêm vào màn hình chính" rồi mở như một app.
- Mở app từ màn hình chính thì vào `/`.

**Ngoài phạm vi**
- Ghép máy bằng QR hoặc mã ghép nối; bố mẹ vẫn đăng nhập trực tiếp trên máy con.
- Thông báo đẩy.
- Chế độ offline.
- Khóa lại khi app ở nền một thời gian.

**Giả định (có thể chỉnh khi review)**
- "Đóng hẳn trình duyệt hoặc app" được hiện thực bằng cookie phiên trình duyệt (không có hạn). Một số trình duyệt có chế độ "mở lại các tab trước" và giữ cookie loại này. Khi đó con không bị hỏi PIN lại; điều này được ghi trong README.
- Máy dùng chung giữ nguyên hành vi hiện tại: phiên con 2 giờ tự gia hạn, phiên thiết bị 90 ngày.
- PIN mới phải khác PIN cũ, và vẫn là đúng 4 chữ số.

## Capabilities

### New Capabilities

### Modified Capabilities
- `family-accounts`:
  - thêm kiểu thiết bị "máy riêng của con" gắn với một con;
  - phiên con trên máy riêng theo phiên trình duyệt;
  - phiên thiết bị máy riêng tự gia hạn;
  - con tự đổi PIN;
  - lối vào ứng dụng ở trang `/`;
  - mở rộng phân quyền của con (thêm đổi PIN của chính mình).
- `ui-theme`: thêm requirement cài đặt ứng dụng lên màn hình chính (manifest, icon, màu theme).

## Impact

- **DB:** migration thêm `sessions.device_child_id` (null với máy dùng chung) và `children.pin_changed_at`.
- **Auth:**
  - `src/server/auth/family-mode.ts`: bật máy riêng, đăng nhập PIN theo kiểu thiết bị, đổi PIN.
  - `src/server/auth/guards.ts`: phiên con phải khớp với con của máy riêng.
  - `src/server/auth/sessions.ts` và `session-cookies.ts`: TTL và kiểu cookie theo kiểu thiết bị.
  - `src/proxy.ts`: không gia hạn cookie phiên con loại phiên trình duyệt.
- **Giao diện:**
  - `src/app/parent/layout.tsx` hoặc trang cài đặt: nút bật máy riêng và danh sách thiết bị.
  - `src/app/kid/page.tsx`: màn đăng nhập của máy riêng.
  - Trang đổi PIN mới trong khu vực con.
  - `src/app/page.tsx`: chuyển trang ở `/`.
  - `src/app/manifest.ts` cùng icon trong `public/`.
- **Bảo mật:** sự kiện log mới `device_enabled` (kèm kiểu thiết bị), `pin_changed` và `pin_reset`; README mục bảo mật.
