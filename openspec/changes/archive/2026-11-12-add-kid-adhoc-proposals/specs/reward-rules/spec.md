# Spec Delta

## ADDED Requirements

### Requirement: Con đề xuất thưởng/phạt ngoài rule
Con SHALL gửi được đề xuất ngoài rule cho chính mình, thuộc một trong hai loại: xin thưởng hoặc tự nhận phạt. Mỗi đề xuất gồm mô tả bắt buộc (tối đa 200 ký tự) và số điểm đề xuất là số nguyên dương. Đề xuất được tạo ở trạng thái "chờ duyệt" và MUST NOT thay đổi số dư. Con SHALL thấy các đề xuất đang chờ duyệt của mình và hủy được đề xuất còn chờ duyệt.

#### Scenario: Xin thưởng ngoài rule
- **WHEN** con gửi đề xuất xin thưởng với mô tả "Giúp bà xách đồ" và 10 điểm
- **THEN** một đề xuất "chờ duyệt" được tạo với mô tả và số điểm đó, và số dư của con chưa thay đổi

#### Scenario: Tự nhận phạt ngoài rule
- **WHEN** con gửi đề xuất tự nhận phạt với mô tả "Con làm vỡ cốc" và 5 điểm
- **THEN** một đề xuất "chờ duyệt" loại phạt được tạo, và số dư của con chưa thay đổi

#### Scenario: Thiếu mô tả
- **WHEN** con gửi đề xuất mà không nhập mô tả
- **THEN** hệ thống từ chối và yêu cầu nhập mô tả

#### Scenario: Số điểm không hợp lệ
- **WHEN** con gửi đề xuất với số điểm 0, số âm hoặc không phải số nguyên
- **THEN** hệ thống từ chối và báo số điểm phải là số nguyên dương

#### Scenario: Hủy đề xuất
- **WHEN** con hủy một đề xuất đang chờ duyệt
- **THEN** đề xuất chuyển sang "đã hủy" và không có giao dịch nào được ghi

#### Scenario: Đề xuất cho con khác
- **WHEN** phiên của một con gửi đề xuất hoặc hủy đề xuất thay cho một con khác
- **THEN** hệ thống từ chối

### Requirement: Giới hạn đề xuất ngoài rule đang chờ
Mỗi con MUST có tối đa 5 đề xuất ngoài rule ở trạng thái "chờ duyệt" cùng lúc, tính chung cả xin thưởng và tự nhận phạt. Đề xuất đã duyệt, bị từ chối hoặc đã hủy không tính vào giới hạn.

#### Scenario: Vượt giới hạn
- **WHEN** con đang có 5 đề xuất chờ duyệt và gửi thêm một đề xuất
- **THEN** hệ thống từ chối và báo con chờ bố mẹ duyệt bớt hoặc hủy một đề xuất

#### Scenario: Gửi lại sau khi được xử lý
- **WHEN** con đang có 5 đề xuất chờ duyệt, bố mẹ duyệt hoặc từ chối một đề xuất, rồi con gửi đề xuất mới
- **THEN** đề xuất mới được tạo

### Requirement: Bố mẹ duyệt đề xuất ngoài rule
Bố mẹ SHALL thấy các đề xuất ngoài rule đang chờ trong hàng chờ duyệt chung của gia đình, kèm loại, mô tả và số điểm con đề xuất, và duyệt hoặc từ chối (kèm lý do tùy chọn) từng đề xuất. Khi duyệt, bố mẹ SHALL giữ nguyên hoặc sửa số điểm thành một số nguyên dương khác. Hệ thống SHALL ghi giao dịch loại "đột xuất" với mô tả của con và số điểm bố mẹ đã chốt: cộng với xin thưởng, trừ với tự nhận phạt. Mỗi đề xuất MUST được xử lý tối đa một lần.

#### Scenario: Duyệt giữ nguyên số điểm
- **WHEN** bố mẹ duyệt đề xuất xin thưởng "Giúp bà xách đồ" 10 điểm mà không sửa số điểm
- **THEN** đề xuất chuyển sang "đã duyệt" và sổ cái của con có thêm giao dịch +10 loại "đột xuất" với mô tả "Giúp bà xách đồ"

#### Scenario: Duyệt với số điểm đã sửa
- **WHEN** con đề xuất xin thưởng 20 điểm và bố mẹ sửa thành 8 điểm rồi duyệt
- **THEN** sổ cái ghi +8, và đề xuất lưu cả số điểm con đề xuất (20) lẫn số điểm được duyệt (8)

#### Scenario: Duyệt tự nhận phạt
- **WHEN** bố mẹ duyệt đề xuất tự nhận phạt "Con làm vỡ cốc" 5 điểm của con đang có 30 điểm
- **THEN** sổ cái có thêm giao dịch -5 loại "đột xuất" và số dư còn 25

#### Scenario: Tự nhận phạt lớn hơn số dư
- **WHEN** bố mẹ duyệt đề xuất tự nhận phạt 10 điểm của con đang có 4 điểm
- **THEN** giao dịch ghi mức gốc -10, mức thực trừ -4, và số dư còn 0

#### Scenario: Số điểm sửa không hợp lệ
- **WHEN** bố mẹ duyệt với số điểm 0, số âm hoặc không phải số nguyên
- **THEN** hệ thống từ chối, đề xuất vẫn "chờ duyệt" và không có giao dịch nào được ghi

#### Scenario: Từ chối đề xuất
- **WHEN** bố mẹ từ chối một đề xuất với lý do "Việc này là việc con phải làm"
- **THEN** đề xuất chuyển sang "bị từ chối", con thấy lý do, và không có giao dịch nào được ghi

#### Scenario: Duyệt lần hai
- **WHEN** một đề xuất đã được duyệt, từ chối hoặc hủy và có thao tác duyệt lần nữa
- **THEN** hệ thống từ chối và không ghi thêm giao dịch

#### Scenario: Đề xuất của con đã lưu trữ
- **WHEN** con gửi đề xuất rồi bị lưu trữ trước khi bố mẹ xử lý
- **THEN** đề xuất vẫn nằm trong hàng chờ duyệt với nhãn "đã lưu trữ", và bố mẹ duyệt hoặc từ chối được

#### Scenario: Đề xuất của gia đình khác
- **WHEN** bố mẹ gửi yêu cầu duyệt một đề xuất thuộc gia đình khác
- **THEN** hệ thống từ chối như thể đề xuất không tồn tại
