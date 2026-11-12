# kid-notifications Specification

## Purpose

Báo cho con biết kết quả các quyết định của bố mẹ: được nhận quà khi một yêu cầu được duyệt hoặc được thưởng, bị trừ điểm, hay bị từ chối kèm lý do. Nhờ vậy con không phải tự dò lịch sử.

## Requirements

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
- **THEN** con có một thông báo chưa đọc loại "bị trừ điểm" với tên rule và số điểm thực trừ

#### Scenario: Yêu cầu bị từ chối
- **WHEN** bố mẹ từ chối một yêu cầu khai rule, đề xuất ngoài rule, báo xong nhiệm vụ hoặc đổi thưởng, kèm lý do
- **THEN** con có một thông báo chưa đọc loại "bị từ chối" với tên mục và lý do

#### Scenario: Duyệt đề xuất xin thưởng với số điểm đã sửa
- **WHEN** con đề xuất xin thưởng "Giúp bà xách đồ" 20 điểm và bố mẹ duyệt với 8 điểm
- **THEN** con có một thông báo chưa đọc loại "nhận quà" với nội dung "Giúp bà xách đồ" và "+8"

#### Scenario: Duyệt đề xuất tự nhận phạt
- **WHEN** bố mẹ duyệt đề xuất tự nhận phạt "Con làm vỡ cốc" 5 điểm
- **THEN** con có một thông báo chưa đọc loại "bị trừ điểm" với nội dung "Con làm vỡ cốc" và số điểm thực trừ

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

### Requirement: Hiển thị thông báo mới
Thông báo chưa đọc SHALL là nguồn quyết định khi nào hiện phản hồi trực quan đã mô tả trong capability `ui-theme` ("Màn ăn mừng khi được cộng điểm", "Màn báo khi bị trừ điểm", "Thứ tự hiển thị phản hồi điểm"). Thông báo "nhận quà" hiện cùng màn ăn mừng; thông báo "bị trừ điểm" hiện cùng thông báo trừ điểm; thông báo "bị từ chối" hiện kèm lý do, không có hiệu ứng ăn mừng. Con xác nhận đã xem thì các thông báo được đánh dấu đã đọc.

#### Scenario: Đăng nhập khi có quà
- **WHEN** con đăng nhập và có hai thông báo "nhận quà" chưa đọc (+15 và +5)
- **THEN** màn ăn mừng hiển thị hai khoản và tổng "+20"; khi con bấm "Nhận quà", cả hai thông báo được đánh dấu đã đọc và số trên chuông giảm tương ứng

#### Scenario: Đang dùng app thì được duyệt
- **WHEN** con đang mở màn hình riêng và bố mẹ duyệt một yêu cầu của con trên thiết bị khác
- **THEN** trong vòng 30 giây, chuông cập nhật số chưa đọc và màn ăn mừng được hiển thị

#### Scenario: Chỉ có thông báo bị từ chối
- **WHEN** con chỉ có thông báo chưa đọc loại "bị từ chối"
- **THEN** hệ thống hiển thị tên mục bị từ chối kèm lý do, không có hiệu ứng ăn mừng

#### Scenario: Đã xem thì không hiện lại
- **WHEN** con đã bấm xác nhận trên màn ăn mừng rồi thoát và đăng nhập lại
- **THEN** màn ăn mừng không hiện lại cho các thông báo đó

### Requirement: Lưu giữ thông báo
Thông báo SHALL được giữ ít nhất 30 ngày. Xóa hoặc đọc thông báo MUST NOT ảnh hưởng tới sổ cái hay lịch sử giao dịch.

#### Scenario: Thông báo cũ
- **WHEN** một thông báo đã quá 30 ngày
- **THEN** hệ thống có thể xóa thông báo đó, còn giao dịch liên quan vẫn còn trong lịch sử
