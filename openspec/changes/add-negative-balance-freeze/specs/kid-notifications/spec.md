# Spec Delta

## MODIFIED Requirements

### Requirement: Tạo thông báo cho con
Hệ thống SHALL tạo một thông báo cho con trong mỗi trường hợp: một giao dịch được ghi cho con (duyệt nhiệm vụ, duyệt khai rule, duyệt đề xuất ngoài rule, bố mẹ áp dụng rule, thưởng/phạt đột xuất, điều chỉnh, duyệt đổi thưởng); một yêu cầu của con bị từ chối. Thông báo MUST được tạo cùng lúc với thao tác của bố mẹ.

#### Scenario: Duyệt nhiệm vụ tạo thông báo nhận quà
- **WHEN** bố mẹ duyệt nhiệm vụ "Làm bài tập" 15 điểm của con
- **THEN** con có một thông báo chưa đọc loại "nhận quà" với nội dung "Làm bài tập" và "+15"

#### Scenario: Duyệt đổi thưởng tạo thông báo nhận quà
- **WHEN** bố mẹ duyệt yêu cầu đổi "30 phút chơi game" giá 50
- **THEN** con có một thông báo chưa đọc loại "nhận quà" với nội dung "Bố mẹ đã duyệt: 30 phút chơi game" và "-50"

#### Scenario: Nhiệm vụ nhóm
- **WHEN** bố mẹ duyệt một nhiệm vụ nhóm cho hai con tham gia
- **THEN** mỗi con được chọn có một thông báo "nhận quà" riêng, con bị bỏ chọn không có thông báo

#### Scenario: Bị phạt
- **WHEN** bố mẹ áp dụng rule phạt 10 điểm cho con
- **THEN** con có một thông báo chưa đọc loại "bị trừ điểm" với tên rule và "−10"

#### Scenario: Yêu cầu bị từ chối
- **WHEN** bố mẹ từ chối một yêu cầu khai rule, đề xuất ngoài rule, báo xong nhiệm vụ hoặc đổi thưởng, kèm lý do
- **THEN** con có một thông báo chưa đọc loại "bị từ chối" với tên mục và lý do

#### Scenario: Duyệt đề xuất xin thưởng với số điểm đã sửa
- **WHEN** con đề xuất xin thưởng "Giúp bà xách đồ" 20 điểm và bố mẹ duyệt với 8 điểm
- **THEN** con có một thông báo chưa đọc loại "nhận quà" với nội dung "Giúp bà xách đồ" và "+8"

#### Scenario: Duyệt đề xuất tự nhận phạt
- **WHEN** bố mẹ duyệt đề xuất tự nhận phạt "Con làm vỡ cốc" 5 điểm
- **THEN** con có một thông báo chưa đọc loại "bị trừ điểm" với nội dung "Con làm vỡ cốc" và "−5"

#### Scenario: Thao tác bị chặn vì đóng băng
- **WHEN** bố mẹ gửi lệnh duyệt hoặc từ chối một yêu cầu đổi thưởng đang đóng băng và hệ thống từ chối thao tác
- **THEN** con không có thông báo mới nào

### Requirement: Chuông thông báo của con
Màn hình của con SHALL hiển thị chuông thông báo kèm số thông báo chưa đọc. Mở chuông SHALL hiển thị danh sách thông báo mới nhất trước. Con MUST chỉ thấy thông báo của chính mình. Số chưa đọc MUST chỉ đếm các thông báo có trong danh sách. Thông báo bị trừ điểm SHALL hiển thị số điểm thực trừ đã ghi trong sổ cái. Thời điểm SHALL hiển thị theo múi giờ của gia đình.

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
- **THEN** thông báo bị trừ điểm hiển thị "−10"

#### Scenario: Thiết bị ở múi giờ khác
- **WHEN** gia đình dùng múi giờ Asia/Ho_Chi_Minh, thiết bị của con đặt múi giờ khác, và một thông báo được tạo lúc 20:00 giờ Việt Nam
- **THEN** chuông hiển thị thời điểm 20:00
