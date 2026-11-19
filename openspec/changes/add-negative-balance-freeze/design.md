# Design

## Context

Xem proposal.md (phần Why) cho động cơ; hành vi chi tiết nằm trong `specs/`. Hiện trạng liên quan:

- Mọi giao dịch đi qua `recordTransaction` trong `src/server/domain/ledger.ts`: khóa dòng của con (`lockChild`, `SELECT ... FOR UPDATE`), đọc số dư, tính `appliedAmount(requested, balance)` để chặn ở 0, INSERT, rồi tạo thông báo trong cùng transaction.
- Bảng `transactions` lưu `requested_amount` và `applied_amount`; CHECK `transactions_applied_within_requested` cho phép `applied` nằm giữa `requested` và 0. Ghi `applied = requested` vẫn thỏa CHECK, kể cả với số âm lớn.
- Số dư luôn là `SUM(applied_amount)`, không có cột cache.
- Theme được đặt bằng `data-theme` ở `KidShell` (server component) và ở overlay phản hồi điểm trong `KidNotificationsProvider`. Token màu sinh từ `THEMES` trong `src/ui/themes.ts`; `theme-contrast.test.ts` kiểm từng cặp màu.
- `KidNotificationsProvider` hỏi `kidUnreadAction` mỗi 30 giây và nhận cả `balance`; màn phản hồi điểm dựng từ thông báo chưa đọc qua `buildScreens` (`src/lib/notification-screens.ts`).
- Cửa hàng (`src/server/domain/shop.ts`): `createRedemption` và `approveRedemption` đã khóa con và so số dư với giá; `cancelRedemption` không khóa con; `rejectRedemption` không đọc số dư.

## Goals / Non-Goals

**Goals:**
- Bỏ chặn ở 0 mà không cần migration và không đụng tới dữ liệu cũ.
- Trạng thái nợ chỉ có một nguồn sự thật là số dư; mọi chỗ hiển thị và mọi quy tắc chặn đều tính từ đó.
- Quy tắc đóng băng yêu cầu đổi thưởng được bảo đảm ở lớp domain, trong transaction có khóa dòng của con, không chỉ bằng nút bị khóa trên giao diện.

**Non-Goals:**
- Không đổi lịch thời gian hỏi định kỳ 30 giây, không thêm cơ chế đẩy thời gian thực.
- Không thêm bảng hay cột mới, không thêm loại thông báo mới.
- Không thêm hoạt ảnh đóng băng/tan băng ngoài màn ăn mừng sẵn có.

## Decisions

### D1. Bỏ chặn ở 0 bằng cách ghi `applied = requested`, giữ nguyên hai cột

`appliedAmount` trả về đúng mức gốc. Hai cột `requested_amount`/`applied_amount` và CHECK hiện có được giữ, vì các dòng cũ đã bị chặn vẫn cần cả hai để lịch sử hiện "mức gốc" và để số dư không bị tính lại.

- *Phương án khác*: bỏ cột `requested_amount` hoặc siết CHECK thành `applied = requested`. Loại vì phải sửa hoặc xóa dòng cũ, trái với sổ cái chỉ ghi thêm.
- Các chỗ hiển thị "mức gốc khác mức thực trừ" (lịch sử, màn bị trừ) giữ nguyên điều kiện `applied !== requested`: với giao dịch mới điều kiện này luôn sai nên tự biến mất, với dòng cũ vẫn hiện đúng.
- `recordAdjustment` không đổi: nó đã đảo `-original.appliedAmount` qua `recordTransaction`, nên khi bỏ chặn thì điều chỉnh trừ đủ.

### D2. Trạng thái nợ là hàm thuần của số dư

Thêm module thuần `src/lib/debt.ts` dùng được cả server lẫn client:

- `isInDebt(balance) = balance < 0`, `debtOf(balance) = max(0, -balance)`.
- `thawProgress(balance, peakDebt)`: phần trăm đã trả (làm tròn xuống, dùng lại `progressPercent`) và số điểm còn cần.
- `tasksToThaw(debt, openTaskPoints[])`: sắp điểm giảm dần, đếm số nhiệm vụ ít nhất có tổng ≥ số nợ; trả `null` nếu cả tổng cũng không đủ.

Không lưu cờ "đang nợ" vào DB: số dư đã là nguồn sự thật và mọi thao tác ghi điểm đều khóa dòng của con, nên tính lại luôn nhất quán.

### D3. Mốc đầu của thanh tan băng tính từ sổ cái

Hàm domain `getDebtInfo(db, childId)` trong `ledger.ts` trả `{ balance, peakDebt }`. `peakDebt` là số nợ lớn nhất kể từ lần gần nhất số dư lũy kế ≥ 0, tính bằng một truy vấn cửa sổ trên `transactions` của con, theo thứ tự `id`:

```
running = SUM(applied_amount) OVER (ORDER BY id)
last_ok = MAX(id) WHERE running >= 0            -- có thể không có
peak    = -MIN(running) WHERE id > last_ok       -- chỉ khi balance < 0
```

Nếu con chưa từng có số dư ≥ 0 sau một giao dịch nào (ví dụ giao dịch đầu tiên là phạt) thì xét toàn bộ lịch sử. Index `(child_id)` sẵn có đủ cho quy mô một gia đình.

- *Phương án khác*: lưu `peak_debt` vào bảng `children`. Loại vì phải cập nhật trong mọi đường ghi điểm và dễ lệch với sổ cái.

### D4. Giao diện đóng băng là một bộ token riêng, ghi đè theme ở hai chỗ đặt `data-theme`

- Thêm `FROZEN_TOKENS` (cùng kiểu `ThemeTokens`) trong `src/ui/themes.ts`, sinh CSS `[data-theme="frozen"]` trong `themeCss()`. Không thêm vào `THEME_IDS`, nên không xuất hiện trong theme picker và `isThemeId("frozen")` là sai, con không lưu được giá trị này.
- Hàm `displayTheme(theme, balance)` trả `"frozen"` khi đang nợ, ngược lại trả theme hiệu lực. `KidShell` và overlay trong `KidNotificationsProvider` dùng hàm này; `kid.theme` trong DB không đổi.
- Theme mascot (`robot`, `magic`) không hiện khi đóng băng, vì mascot thuộc theme con chọn.
- `ChibiAvatar` thêm `mood="cold"` (mặt run, má xanh). Header và sidebar của `KidShell` truyền `cold` khi đang nợ.
- Layout khu vực con đã đọc `unread.balance`; truyền thêm vào `KidShell` để tính theme.
- `theme-contrast.test.ts` chạy cùng danh sách cặp màu cho `FROZEN_TOKENS`.

Hướng màu đề xuất: nền xanh băng nhạt, thẻ trắng ngả xanh, `primary` xanh thép đậm, chữ xanh than. Mã màu cụ thể chọn lúc làm, miễn qua test tương phản.

### D5. Màn hình tự đổi khi trạng thái nợ đổi trong lúc mở app

`KidShell` là server component nên không đổi theo state ở client. Trong `KidNotificationsProvider.apply`, nếu `isInDebt(payload.balance) !== isInDebt(balance hiện tại)` thì gọi `router.refresh()` để render lại layout và trang hiện tại với số dư mới. Overlay dùng `displayTheme` với `balance` trong state nên đổi ngay.

Đóng màn "Tan băng rồi!" cũng gọi `router.refresh()` để chắc giao diện về theme thường kể cả khi lần hỏi định kỳ chưa tới.

### D6. Màn tan băng tính lúc hiển thị, không cần loại thông báo mới

`NotificationView` đã có `transactionId`. Thêm vào truy vấn thông báo chưa đọc một cột `balanceAfter` = tổng `applied_amount` của con với `id <= transaction_id` (subquery tương quan, chỉ chạy cho thông báo có giao dịch). `balanceBefore = balanceAfter - amount`.

`buildScreens(items, currentBalance)` đặt `thawed = true` cho màn ăn mừng khi có ít nhất một khoản cộng có `balanceBefore < 0 <= balanceAfter` **và** `currentBalance >= 0`. Điều kiện thứ hai xử lý scenario "Tan băng rồi lại bị phạt trước khi xem". Màn ăn mừng khi `currentBalance < 0` hiện thêm dòng "Con còn nợ X nữa thôi".

- *Phương án khác*: thêm loại thông báo `thaw` tạo trong `recordTransaction`. Loại vì cần migration cho CHECK `notifications_kind`, và vẫn phải xử lý trường hợp bị phạt lại trước khi xem.
- Giao dịch đổi thưởng là âm nên không bao giờ thỏa điều kiện tan băng.

### D7. Đóng băng yêu cầu đổi thưởng ở lớp domain

Thêm mã lỗi `FROZEN` vào `DomainErrorCode` với thông điệp riêng, để UI phân biệt với `INSUFFICIENT_BALANCE`.

| Hàm | Thay đổi |
|---|---|
| `createRedemption` | Sau `lockChild`, nếu `balance < 0` thì ném `FROZEN` trước khi kiểm giá |
| `cancelRedemption` | Chuyển vào transaction, `lockChild` con, nếu `balance < 0` thì ném `FROZEN` |
| `approveRedemption` | Sau `lockChild`, nếu `balance < 0` thì ném `FROZEN` (trước nhánh `INSUFFICIENT_BALANCE`), kể cả con đã lưu trữ |
| `rejectRedemption` | Thêm `lockChild` (lấy cả `archivedAt`); nếu `balance < 0` và con chưa lưu trữ thì ném `FROZEN` trước khi đổi trạng thái hay tạo thông báo |

Thứ tự khóa trong `approve`/`reject` là yêu cầu rồi tới con, giống `approveRedemption` hiện nay; `cancel` chỉ khóa con rồi UPDATE có điều kiện. Một khoản phạt chạy song song chỉ khóa con, nên không có vòng khóa.

`listPendingRedemptions` trả thêm `frozen = balance < 0 && !childArchived`; hàng chờ duyệt truyền `frozen` vào `DecisionForm` để khóa cả hai nút và hiện nhãn. Cửa hàng của con ẩn nút hủy khi đang nợ.

Gửi yêu cầu vẫn so `balance >= price` như cũ; với giá luôn dương, kiểm `FROZEN` trước chỉ đổi thông điệp lỗi, không đổi kết quả.

### D8. Báo trước "sẽ nợ X" chỉ là hiển thị

`apply-panel.tsx` đã có `kid.balance` và số điểm; thay khối `capped` bằng `after < 0` để hiện "Sau khi phạt, con sẽ nợ X". Hàng chờ duyệt đổi cảnh báo của đề xuất tự nhận phạt tương tự, tính theo số điểm mặc định. Không có bước xác nhận thêm.

### D9. Màn chính và cửa hàng khi đang nợ

- Màn chính: khi đang nợ, ô số dư hiện "Đang nợ X", thay thẻ mục tiêu bằng thẻ tan băng (`getDebtInfo` + `thawProgress`), và thêm thẻ động viên. Lối tắt trỏ tới các nhiệm vụ còn làm được trong `getChildToday` (trạng thái chưa báo), `/kid/rules` (rule thưởng) và form đề xuất xin thưởng ở `/kid/rules`.
- Lời động viên: một danh sách câu cố định trong `src/lib/debt.ts`, chọn theo ngày trong múi giờ gia đình để không đổi mỗi lần tải trang. Khi `tasksToThaw` có kết quả thì dùng câu có số nhiệm vụ.
- Cửa hàng: banner "Cửa hàng đang đóng băng" kèm số nợ; thẻ phần thưởng hiện trạng thái khóa thay cho nút "Đổi" và "Còn thiếu X"; chọn mục tiêu vẫn hoạt động. `goalProgress` đã đúng với số dư âm (`progressPercent` chặn ở 0, `remaining = price - balance`).
- Trang tổng quan bố mẹ: thẻ con hiện chip "đang nợ" và số nợ thay cho số âm.

## Risks / Trade-offs

- [Con thấy giao diện đóng băng như bị bêu, nhất là khi nợ kéo dài] → Lời động viên luôn hiện cùng lối tắt có thể làm ngay; câu chữ không trách mắng (spec debt-freeze). Theme cũ quay lại ngay khi hết nợ.
- [Nợ quá sâu khiến con buông xuôi, vì không có sàn] → Ngoài phạm vi theo quyết định đã chốt; bố mẹ thấy số nợ ở trang tổng quan và có thể thưởng đột xuất để gỡ. Có thể thêm sàn sau mà không đổi mô hình dữ liệu.
- [`rejectRedemption` thêm khóa con có thể làm chậm khi bố mẹ xử lý nhiều yêu cầu cùng lúc] → Khóa chỉ trên một dòng của một con, giữ trong thời gian rất ngắn; cùng mức với `approveRedemption` hiện nay.
- [Truy vấn cửa sổ cho `peakDebt` và subquery `balanceAfter` chạy trên toàn bộ lịch sử của con] → Chỉ chạy khi đang nợ (`peakDebt`) hoặc cho tối đa vài thông báo chưa đọc (`balanceAfter`); số giao dịch mỗi con ở quy mô gia đình là nhỏ. Nếu chậm thì thêm index `(child_id, id)`.
- [Màn hình chậm tối đa 30 giây mới chuyển sang đóng băng] → Chấp nhận, cùng độ trễ với thông báo hiện nay (spec ghi "trong vòng 30 giây").
- [Test và e2e hiện khẳng định số dư không âm] → Viết lại trong cùng nhóm task với thay đổi ledger, không để dồn về cuối.

## Migration Plan

- Không có migration DB. Triển khai như bình thường; giao dịch mới tự theo quy tắc mới, dòng cũ giữ nguyên.
- Ngay sau khi triển khai, không con nào ở trạng thái nợ vì số dư cũ đều ≥ 0.
- Rollback: quay về bản trước là đủ để giao dịch mới lại bị chặn ở 0. Các con đã có số dư âm vẫn âm (sổ cái không sửa được); bản cũ hiển thị số âm nhưng không lỗi, vì CHECK và mọi truy vấn chấp nhận giá trị đó. Nếu cần đưa về 0 thì bố mẹ thưởng đột xuất.
