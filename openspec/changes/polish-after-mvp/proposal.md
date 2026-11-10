# Proposal

## Why

Sau ba change đầu, app đã đủ các tính năng trong tài liệu khảo sát. Vẫn còn vài chỗ nên sửa trước khi gia đình dùng thật:
- hai mục mà change `fix-review-low-findings` đã để lại cho sau;
- một cảnh báo khi render;
- bảng nhiệm vụ khó dùng trên điện thoại.

Mục quan trọng nhất là phiên bố mẹ trên máy của con. Bố mẹ đăng nhập lại trên máy đang bật chế độ gia đình (ví dụ để duyệt nhanh) thì phiên đó sống 30 ngày và tự gia hạn. Con cầm máy sau đó vào được khu vực bố mẹ.

## What Changes

**Phiên bố mẹ trên máy của con**
- Bố mẹ đăng nhập trên thiết bị đang bật chế độ gia đình (máy dùng chung hoặc máy riêng của con) thì phiên bố mẹ hết hạn sau 15 phút không thao tác. Còn dùng thì phiên tự gia hạn.
- Trên thiết bị không bật chế độ gia đình, phiên bố mẹ vẫn giữ 30 ngày như hiện tại.
- Thiết bị có bật chế độ gia đình hay không được xác định lúc đăng nhập, qua phiên thiết bị còn hiệu lực trên thiết bị đó.

**Lịch sử phía con**
- Con lọc được lịch sử của mình theo khoảng ngày và loại giao dịch, giống phía bố mẹ.
- Bộ lọc giữ nguyên khi bấm "Xem thêm".

**Bảng nhiệm vụ trên màn hình hẹp**
- Dưới 768px, danh sách nhiệm vụ của bố mẹ hiển thị dạng thẻ thay cho bảng cuộn ngang.
- Mỗi thẻ có đủ thông tin và hai nút "Sửa", "Tạm dừng".
- Từ 768px trở lên vẫn là bảng như hiện tại.

**Sửa lỗi**
- Hết cảnh báo "unstable value `Date.now()` while prerendering" ở trang `/parent/settings`.
- Ngày bật và ngày hết hạn của thiết bị trong cài đặt hiển thị theo múi giờ của gia đình, không theo múi giờ của trình duyệt.

**Giả định (chờ anh duyệt)**
- Mốc 15 phút không thao tác là phương án đề xuất. Hai phương án khác đã cân nhắc: hết hạn cố định sau 1 giờ, hoặc phiên trình duyệt (mất khi đóng hẳn trình duyệt). Đổi mốc chỉ cần sửa một hằng số.
- Phiên bố mẹ đã có từ trước khi bật chế độ gia đình bị kết thúc ngay khi bật, như hiện tại. Giới hạn 15 phút chỉ áp dụng cho lần đăng nhập sau đó.

**Ngoài phạm vi**
- Xác nhận lại bằng mật khẩu trước các thao tác nhạy cảm.
- Nút "Khóa nhanh" để bố mẹ tự kết thúc phiên trên máy của con. Nút "Đăng xuất" hiện có vẫn dùng được.

## Capabilities

### New Capabilities

### Modified Capabilities
- `family-accounts`: requirement "Đăng nhập bố mẹ" thêm thời hạn phiên ngắn khi đăng nhập trên thiết bị đang bật chế độ gia đình.
- `currency-ledger`: requirement "Xem lịch sử giao dịch" thêm việc con lọc được theo ngày và loại giao dịch.
- `ui-theme`: requirement "Giao diện responsive" thêm hành vi danh sách dạng bảng ở màn hình hẹp.

## Impact

- **Xác thực:**
  - `src/server/auth/sessions.ts`, `src/server/auth/parent-auth.ts`, `src/app/actions/auth.ts`.
  - Bảng `sessions` thêm cột thời hạn riêng cho từng phiên, qua migration mới `0006`.
- **Lịch sử:** `src/app/kid/(app)/history/page.tsx`, và có thể tách form lọc dùng chung từ `src/app/parent/history/page.tsx`.
- **Nhiệm vụ:** `src/app/parent/tasks/page.tsx`, `src/app/parent/tasks/task-form.tsx`.
- **Cài đặt:** `src/app/parent/settings/page.tsx`, `src/app/parent/settings/settings-forms.tsx`.
- **Test:** unit cho phiên ngắn; e2e cho bộ lọc lịch sử phía con, bảng nhiệm vụ ở 360px, và log không còn cảnh báo prerender.
