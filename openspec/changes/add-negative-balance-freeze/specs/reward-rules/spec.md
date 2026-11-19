# Spec Delta

## MODIFIED Requirements

### Requirement: Áp dụng rule cho con
Bố mẹ SHALL áp dụng một rule đang hiện cho một con, kèm ghi chú tùy chọn. Hệ thống SHALL ghi một giao dịch loại "rule" vào sổ cái; rule phạt trừ đủ số điểm của rule, kể cả khi làm số dư nhỏ hơn 0.

#### Scenario: Áp dụng rule thưởng
- **WHEN** bố mẹ áp dụng rule thưởng 5 điểm cho con
- **THEN** sổ cái của con có thêm giao dịch +5 mang tên rule

#### Scenario: Áp dụng rule phạt
- **WHEN** bố mẹ áp dụng rule phạt 10 điểm cho con đang có 30 điểm
- **THEN** sổ cái có thêm giao dịch -10 và số dư còn 20

#### Scenario: Áp dụng rule phạt lớn hơn số dư
- **WHEN** bố mẹ áp dụng rule phạt 10 điểm cho con đang có 4 điểm
- **THEN** sổ cái có thêm giao dịch -10 và số dư là -6

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
- **THEN** giao dịch ghi -10 và số dư là -6

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
