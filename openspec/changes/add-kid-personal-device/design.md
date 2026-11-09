# Design

## Context

Thiết kế auth hiện tại (D4 của change MVP đã archive; xem `src/server/auth/`):
- Bảng `sessions(id_hash, subject_type, subject_id, expires_at)`. Phiên `device` có `subject_id = families.id`, hạn cố định 90 ngày.
- Phiên `child` có hạn 2 giờ, tự gia hạn. `authenticateChild` yêu cầu có phiên `device` cùng gia đình.
- Bật chế độ gia đình (`enableFamilyMode`) xóa phiên bố mẹ trên thiết bị đó.
- `src/proxy.ts` gia hạn cookie `mc_parent`/`mc_child` ở mỗi request GET.
- PIN của con được băm bằng argon2id trong `children.pin_hash`. Bố mẹ đổi PIN qua `updateChild`. Bộ đếm sai PIN nằm trên dòng `children` (`failed_pin_count`, `locked_until`).
- Trang `/` là trang tĩnh, không có link và không chuyển trang.
- Next 16 có file convention `app/manifest.ts` (xem `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`).

## Goals / Non-Goals

**Goals:**
- Máy riêng gắn với một con và được kiểm tra ở server.
- Trên máy riêng, con nhập PIN mỗi khi mở lại trình duyệt hoặc app.
- Con tự đổi PIN an toàn, có log.
- Mở ứng dụng từ `/` hoặc từ màn hình chính đều vào đúng chỗ.

**Non-Goals:**
- Ghép máy bằng QR hoặc mã.
- Thông báo đẩy.
- Service worker và chế độ offline.
- Khóa khi app nằm ở nền.

## Decisions

### D1. Lưu kiểu thiết bị trong `sessions`
- Thêm cột `sessions.device_child_id` (FK `children.id`, có thể null), chỉ dùng cho phiên `device`:
  - `null` là máy dùng chung;
  - có giá trị là máy riêng của con đó.
- CHECK: `device_child_id is null or subject_type = 'device'`.
- Thêm index `(device_child_id)` để thu hồi khi lưu trữ con.
- *Thay thế*: thêm `subject_type = 'kid_device'`. Bị loại vì mọi chỗ đang kiểm tra `device` (guard, danh sách thiết bị, thu hồi) sẽ phải xử lý hai loại.

### D2. Thời hạn phiên theo kiểu thiết bị
- Phiên `device` của máy riêng tự gia hạn: TTL 90 ngày tính từ lần dùng cuối. Máy dùng chung giữ hạn cố định.
- `resolveSession` nhận thêm thông tin "phiên trượt" từ dòng session (`device_child_id is not null`), không chỉ từ `subject_type`.
- Phiên `child` tạo trên máy riêng:
  - DB có TTL 30 ngày, tự gia hạn; đây là chốt chặn phía server nếu trình duyệt giữ cookie quá lâu;
  - cookie `mc_child` đặt **không có `expires`** (cookie phiên trình duyệt), nên đóng hẳn trình duyệt thì cookie mất và con phải nhập PIN.
- `loginChildWithPin` nhận `device` (gồm `deviceChildId`) và trả `{ token, expiresAt, browserSession: boolean }`. Action dựa vào cờ đó để đặt cookie có hoặc không có hạn.
- `src/proxy.ts` không gia hạn `mc_child` khi đó là cookie phiên trình duyệt. Proxy không đọc DB, nên ta đặt thêm cookie không nhạy cảm `mc_child_mode=browser` (httpOnly, cũng là cookie phiên) cùng lúc với `mc_child`. Proxy thấy cookie này thì bỏ qua `mc_child`.
  - *Thay thế*: proxy gọi DB. Bị loại vì proxy nên nhẹ và không phụ thuộc DB.

### D3. Guard và đăng nhập trên máy riêng
- `authenticateDevice` trả thêm `childId` (null nếu là máy dùng chung).
- `authenticateChild` kiểm tra thêm: nếu `device.childId` khác null thì `session.subjectId` phải bằng giá trị đó.
- `listKidsForDevice` chỉ trả con của máy riêng.
- `loginChildWithPin` từ chối với `NOT_FOUND` khi `childId` không khớp máy riêng. Không tăng bộ đếm sai PIN của con kia, để máy riêng của Bin không làm khóa được Na.
- Bật máy riêng:
  1. `enablePersonalDevice(db, auth, childId, clock, parentToken, currentDeviceToken)` kiểm tra con thuộc gia đình và chưa lưu trữ;
  2. xóa phiên bố mẹ và phiên thiết bị cũ của chính máy đó;
  3. tạo phiên `device` có `device_child_id`.
- Giao diện: trong layout bố mẹ, nút "Bật chế độ gia đình" thành menu có hai lựa chọn: "Máy dùng chung" và "Máy riêng của…" kèm danh sách con.
- `archiveChild` xóa thêm các phiên `device` có `device_child_id = childId`, trong cùng transaction.
- `listDevices` trả `kind` cùng `childName`, để hiện "Máy riêng của Bin".

### D4. Đổi PIN
- `changeChildPin(db, kid, { currentPin, newPin, confirmPin }, clock)`:
  1. trong transaction, khóa dòng `children` (`FOR UPDATE`);
  2. nếu `locked_until` còn hiệu lực thì từ chối (`LOCKED`), như đăng nhập;
  3. kiểm tra PIN hiện tại; sai thì tăng `failed_pin_count` và khóa 5 phút khi tới 5 lần, dùng chung hàm với `loginChildWithPin`;
  4. kiểm tra PIN mới: đúng 4 chữ số, khác PIN cũ, hai lần nhập trùng nhau;
  5. cập nhật `pin_hash`, `pin_changed_at = now`, `failed_pin_count = 0`.
- Bị khóa khi đang đổi PIN thì phiên hiện tại vẫn giữ; chỉ việc đổi PIN và các lần đăng nhập mới bị chặn.
- Phiên con khác của chính con đó, trên thiết bị khác, **giữ nguyên**. PIN chỉ dùng ở bước đăng nhập; giữ phiên thì con không bị đẩy ra trên máy dùng chung đang mở.
- `updateChild` (bố mẹ đặt lại PIN) cũng ghi `pin_changed_at`.
- Log:
  - `pin_changed` gồm `familyId` và `childId`, không bao giờ gồm PIN;
  - `pin_reset` gồm `familyId`, `childId` và `parentId`.
- Cài đặt bố mẹ hiện "PIN đổi lần cuối: <ngày>" ở thẻ của từng con.
- Giao diện con:
  - trang `/kid/pin` dùng bàn phím số giống màn đăng nhập, ba bước: PIN hiện tại, PIN mới, nhập lại;
  - lối vào nằm trong menu "Giao diện" (sidebar) và trong header ở điện thoại.

### D5. Lối vào ở `/`
- Chuyển trang ngay trong `src/proxy.ts` khi `pathname === "/"`, chỉ dựa vào cookie có mặt hay không, không đọc DB. Thứ tự:
  1. `mc_child` → `/kid/home`;
  2. `mc_device` → `/kid`;
  3. `mc_parent` → `/parent`;
  4. còn lại → `/login`.
- Cookie cũ đã hết hiệu lực thì guard ở trang đích chuyển tiếp như hiện nay (`/kid/home` → `/kid` → …), nên không có vòng lặp.
- `src/app/page.tsx` giữ làm dự phòng, nhưng thêm link "Bố mẹ đăng nhập" và "Con đăng nhập".

### D6. Manifest và icon
- `src/app/manifest.ts`:
  - `name: "Sao nhà mình"`, `short_name: "Sao nhà mình"`;
  - `start_url: "/"`, `display: "standalone"`;
  - `background_color` và `theme_color` lấy từ theme mặc định `sunny`.
- Icon:
  - `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, vẽ từ icon ngôi sao có sẵn trong `public/themes/sunny/`;
  - `src/app/apple-icon.png` cho iOS.
- Không thêm service worker. Bản thân manifest đủ để "Thêm vào màn hình chính"; Chrome trên Android có thể không hiện lời mời cài, nhưng menu vẫn có mục đó.
- Matcher của proxy và CSP: kiểm tra `manifest.webmanifest` và icon không bị chặn (`manifest-src 'self'`).

## Risks / Trade-offs

- [Trình duyệt khôi phục phiên ("Tiếp tục từ nơi bạn đã dừng") giữ cookie phiên, nên con không bị hỏi PIN lại] → README ghi rõ. TTL 30 ngày trong DB là chốt chặn; có thể thêm khóa khi app ở nền trong change khác nếu cần.
- [iOS ở chế độ standalone xóa cookie phiên khi app bị tắt hẳn, khớp với yêu cầu; nhưng iOS cũng có thể tự tắt app ở nền sau một thời gian] → Con nhập PIN thường hơn trên iOS. Chấp nhận, vì đó là hành vi "mở lại app".
- [Cookie `mc_child_mode` bị sửa tay ở phía client] → Cookie này chỉ quyết định proxy có gia hạn cookie hay không; quyền vẫn do DB và guard kiểm tra, nên không mở rộng được quyền.
- [Đổi PIN mà không hủy phiên khác: nếu con đổi PIN vì nghi bị lộ, kẻ đang đăng nhập vẫn còn phiên] → Phiên con trên máy dùng chung chỉ 2 giờ; máy riêng thì chỉ chính con dùng. Có thể thêm "Đăng xuất mọi nơi" sau.
- [Migration thêm cột vào `sessions`, một bảng đang dùng] → Thêm cột có thể null thì không khóa bảng lâu; dữ liệu cũ mặc nhiên là máy dùng chung.
