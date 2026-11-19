# Proposal

## Why

Số dư hiện bị chặn ở 0: khi phạt nhiều hơn số điểm con đang có, phần vượt bị bỏ. Con đã hết điểm (hoặc vừa đổi hết quà) thì bị phạt bao nhiêu cũng không mất gì, nên hình phạt mất tác dụng đúng lúc cần nhất. Cùng một lần thưởng và một lần phạt, bấm theo thứ tự khác nhau lại cho số dư khác nhau, và hoàn tác một lần thưởng nhầm sau khi con đã tiêu hết thì không thu lại được.

Cho số dư xuống dưới 0 sửa cả ba điểm trên. Để số nợ không thành một con số âm khô khan với trẻ, màn hình của con chuyển sang trạng thái "đóng băng" kèm lời động viên và lối tắt kiếm điểm, với một mục tiêu rõ ràng: kiếm đủ điểm để tan băng.

## What Changes

- **BREAKING** Bỏ quy tắc số dư không âm. Khoản phạt (áp dụng rule phạt, phạt đột xuất, duyệt đề xuất tự nhận phạt) và giao dịch điều chỉnh luôn trừ đủ mức gốc, số dư có thể nhỏ hơn 0 và không có mức sàn.
- Các lần phạt cũ đã bị chặn ở 0 giữ nguyên như đã ghi; không tính lại và không tạo nợ hồi tố.
- Thêm **trạng thái nợ**: con ở trạng thái nợ khi số dư nhỏ hơn 0, và ra khỏi trạng thái này khi số dư về 0 trở lên. Số dư đúng bằng 0 không tính là nợ. Trạng thái được tính từ số dư, không lưu riêng.
- Khi con đang nợ, mọi màn hình của con dùng giao diện đóng băng: một bảng màu băng dùng chung thay tạm theme con đã chọn, avatar chibi đổi nét mặt, số dư hiện dạng "đang nợ X" thay cho số âm. Theme con đã chọn được giữ nguyên và trở lại khi hết nợ.
- Màn chính của con khi đang nợ hiện thanh tiến độ "tan băng" (thay cho thanh mục tiêu tiết kiệm), lời động viên, và lối tắt tới các cách kiếm điểm đã có: nhiệm vụ hôm nay, khai rule thưởng, đề xuất xin thưởng.
- Khi số dư về 0 trở lên, con thấy màn ăn mừng "Tan băng rồi!" và giao diện trở lại bình thường.
- Cửa hàng khi con đang nợ: con vẫn xem được phần thưởng và chọn được mục tiêu, nhưng không gửi được yêu cầu đổi; cửa hàng hiện trạng thái đóng băng thay cho "còn thiếu X".
- Yêu cầu đổi thưởng đang chờ duyệt của con đang nợ bị đóng băng: bố mẹ không duyệt và cũng không từ chối được, con cũng không tự hủy được; hàng chờ duyệt và cửa hàng của con hiện rõ lý do. Yêu cầu không đổi trạng thái và xử lý lại được bình thường khi con hết nợ.
- Ngoại lệ: việc đóng băng yêu cầu đổi thưởng không áp dụng cho con đã lưu trữ. Con đã lưu trữ không nhận thêm thưởng nên sẽ không bao giờ hết nợ; bố mẹ vẫn từ chối được yêu cầu của con đó để yêu cầu không kẹt vĩnh viễn.
- Khi con được cộng điểm mà vẫn còn nợ, màn ăn mừng vẫn hiện như thường, kèm số nợ còn lại.
- Phía bố mẹ: trang tổng quan đánh dấu con đang nợ kèm số nợ; màn Thưởng/Phạt và hàng chờ duyệt báo trước "sẽ nợ X" khi một khoản phạt làm số dư xuống dưới 0, thay cho cảnh báo "chỉ trừ được X" hiện nay.
- Màn báo bị trừ điểm, chuông thông báo và lịch sử hiện đúng số điểm bị trừ; không còn phân biệt mức gốc và mức thực trừ với các giao dịch mới.

Không đổi: điều kiện gửi và duyệt đổi thưởng khi số dư từ 0 trở lên (vẫn so số dư với giá); đổi thưởng không bao giờ tạo nợ; cách thưởng, nhiệm vụ hằng ngày, khai rule và đề xuất ngoài rule.

Ngoài phạm vi: mức sàn cho số nợ; công tắc bật/tắt số dư âm theo gia đình; tự động xóa nợ theo thời gian.

## Capabilities

### New Capabilities

- `debt-freeze`: trạng thái nợ của con khi số dư nhỏ hơn 0. Gồm định nghĩa trạng thái, giao diện đóng băng trên màn hình của con, thanh tan băng, lời động viên và lối tắt kiếm điểm, màn "Tan băng rồi!" khi hết nợ, và dấu hiệu con đang nợ ở phía bố mẹ.

### Modified Capabilities

- `currency-ledger`: bỏ requirement "Số dư không âm", thay bằng quy tắc khoản trừ luôn ghi đủ và số dư được phép âm; scenario điều chỉnh làm số dư âm.
- `reward-rules`: các requirement "Áp dụng rule cho con" và "Bố mẹ duyệt đề xuất ngoài rule" không còn dẫn chiếu quy tắc số dư không âm; scenario "Tự nhận phạt lớn hơn số dư" đổi thành trừ đủ và số dư âm.
- `reward-shop`: "Con xem cửa hàng" và "Con gửi yêu cầu đổi thưởng" thêm trường hợp đang nợ; con không hủy được yêu cầu đang chờ khi đang nợ; "Bố mẹ duyệt yêu cầu đổi thưởng" thêm quy tắc đóng băng cả duyệt lẫn từ chối khi con đang nợ, trừ con đã lưu trữ; "Mục tiêu tiết kiệm" quy định tiến độ khi số dư âm.
- `kid-notifications`: các scenario dùng "số điểm thực trừ" và "Phạt vượt số dư trong chuông" đổi theo quy tắc trừ đủ.
- `ui-theme`: "Màn báo khi bị trừ điểm" hiện số nợ khi số dư sau khi trừ nhỏ hơn 0; "Bộ theme chibi" ghi nhận bảng màu đóng băng là ngoại lệ với "tươi sáng" nhưng vẫn phải đạt tương phản 4.5:1; "Màn hình chính của con" dẫn chiếu trạng thái nợ.

## Impact

- `src/server/domain/ledger.ts`: bỏ phép chặn ở 0 trong `appliedAmount`; giao dịch mới có mức thực ghi bằng mức gốc. Cột `requested_amount`, `applied_amount` và CHECK hiện có vẫn hợp lệ với cả dòng cũ lẫn dòng mới, nên dự kiến không cần migration.
- `src/server/domain/shop.ts`: chặn gửi yêu cầu, hủy, duyệt và từ chối khi con đang nợ (riêng con đã lưu trữ vẫn từ chối được), với thông báo lỗi riêng; tiến độ mục tiêu khi số dư âm.
- `src/ui/themes.ts`, `src/app/globals.css`, `src/ui/kid-shell.tsx`, `src/ui/chibi.tsx`: bảng màu đóng băng, ghi đè theme theo số dư, nét mặt mới cho chibi.
- `src/app/kid/(app)/`: màn chính, cửa hàng, màn phản hồi điểm (`points-feedback.tsx`, `kid-notifications.tsx`) và `src/lib/notification-screens.ts` cho thanh tan băng, lời động viên, màn "Tan băng rồi!".
- `src/app/parent/`: trang tổng quan, `apply/apply-panel.tsx`, `approval-queue.tsx` cho dấu hiệu đang nợ và cảnh báo "sẽ nợ X".
- Test: viết lại các test đang khẳng định số dư không âm (`tests/domain/currency.test.ts`, `tests/db/approval-race.test.ts` và các test liên quan), thêm bảng màu đóng băng vào `tests/domain/theme-contrast.test.ts`, thêm test domain và e2e cho trạng thái nợ.
- Dữ liệu hiện có không đổi. Không thêm thư viện, không đổi cấu hình triển khai.
