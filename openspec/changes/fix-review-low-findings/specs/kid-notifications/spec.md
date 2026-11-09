## MODIFIED Requirements

### Requirement: Chuông thông báo của con
Màn hình của con SHALL hiển thị chuông thông báo kèm số thông báo chưa đọc. Mở chuông SHALL hiển thị danh sách thông báo mới nhất trước. Con MUST chỉ thấy thông báo của chính mình. Số chưa đọc MUST chỉ đếm các thông báo có trong danh sách. Thông báo bị trừ điểm SHALL hiển thị số điểm thực trừ. Thời điểm SHALL hiển thị theo múi giờ của gia đình.

#### Scenario: Có thông báo chưa đọc
- **WHEN** con có 3 thông báo chưa đọc
- **THEN** chuông hiển thị số 3

#### Scenario: Mở danh sách
- **WHEN** con mở chuông thông báo
- **THEN** con thấy các thông báo mới nhất trước, mỗi thông báo có loại, nội dung, số điểm (nếu có) và thời điểm

#### Scenario: Số chưa đọc khớp danh sách
- **WHEN** con có một thông báo chưa đọc đã quá 30 ngày và hai thông báo chưa đọc mới
- **THEN** chuông hiển thị số 2 và danh sách có đúng hai thông báo chưa đọc đó

#### Scenario: Phạt vượt số dư trong chuông
- **WHEN** con có 3 điểm và bị phạt 10 điểm, rồi mở chuông
- **THEN** thông báo bị trừ điểm hiển thị "−3"

#### Scenario: Thiết bị ở múi giờ khác
- **WHEN** gia đình dùng múi giờ Asia/Ho_Chi_Minh, thiết bị của con đặt múi giờ khác, và một thông báo được tạo lúc 20:00 giờ Việt Nam
- **THEN** chuông hiển thị thời điểm 20:00
