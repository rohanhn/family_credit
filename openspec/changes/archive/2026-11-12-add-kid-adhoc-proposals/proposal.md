# Proposal

## Why

Hiện con chỉ xin thưởng được với rule thưởng có sẵn (nút "Con đã làm"). Việc tốt nằm ngoài danh sách rule thì con phải nhờ bố mẹ tự vào màn Thưởng/Phạt ghi tay, và con không có cách nào tự nhận lỗi. Cho con tự đề xuất giúp con chủ động và trung thực hơn, còn quyền quyết định vẫn ở bố mẹ.

## What Changes

- Ở màn "Rule của nhà mình", con gửi được đề xuất ngoài rule theo hai loại: xin thưởng hoặc tự nhận phạt. Mỗi đề xuất gồm mô tả việc đã làm (bắt buộc) và số điểm con đề xuất.
- Đề xuất ở trạng thái "chờ duyệt", không đổi số dư. Con thấy các đề xuất đang chờ và hủy được.
- Mỗi con có tối đa 5 đề xuất ngoài rule đang chờ duyệt cùng lúc, để hàng chờ của bố mẹ không bị ngập.
- Đề xuất hiện trong hàng chờ duyệt chung của bố mẹ. Khi duyệt, bố mẹ giữ nguyên số điểm con đề xuất hoặc sửa thành số khác; hoặc từ chối kèm lý do tùy chọn.
- Duyệt thì ghi một giao dịch loại "đột xuất" với mô tả của con: cộng điểm nếu là xin thưởng, trừ điểm nếu là tự nhận phạt (vẫn theo quy tắc số dư không âm).
- Con nhận thông báo như các yêu cầu khác: màn ăn mừng khi được cộng, màn báo bị trừ khi bị trừ, thông báo "bị từ chối" kèm lý do khi bị từ chối.

Không đổi: khai rule thưởng có sẵn ("Con đã làm"), rule phạt vẫn chỉ để xem, màn Thưởng/Phạt của bố mẹ.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `reward-rules`: thêm yêu cầu con đề xuất thưởng/phạt ngoài rule, giới hạn số đề xuất đang chờ, và bố mẹ duyệt đề xuất với số điểm sửa được.
- `kid-notifications`: requirement "Tạo thông báo cho con" tính thêm trường hợp duyệt và từ chối đề xuất ngoài rule.
- `family-accounts`: requirement "Phân quyền bố mẹ và con" thêm "đề xuất thưởng/phạt ngoài rule" vào các thao tác của con.

## Impact

- Cơ sở dữ liệu: thêm bảng lưu đề xuất ngoài rule và một migration mới.
- `src/server/domain/`: module mới cho đề xuất ngoài rule, dùng lại sổ cái và thông báo hiện có.
- `src/app/actions/rules.ts`: thêm action gửi, hủy (phía con) và duyệt, từ chối (phía bố mẹ).
- `src/app/kid/(app)/rules/`: form đề xuất và danh sách đang chờ.
- `src/app/parent/approval-queue.tsx`, `decision-form.tsx`: mục mới trong hàng chờ, có ô sửa số điểm khi duyệt.
- Test: unit test domain, test chống race khi duyệt đồng thời, test phân quyền và luồng e2e.
- Không thêm thư viện, không đổi cấu hình triển khai. Migration chạy tự động khi container khởi động như các migration trước.
