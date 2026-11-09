# Spec Delta

## Purpose

Đảm bảo ứng dụng dùng tốt trên điện thoại, máy tính bảng và máy tính, có giao diện tươi sáng phong cách chibi hấp dẫn trẻ, cho phép đổi theme, và phản hồi trực quan khi điểm thay đổi.

## ADDED Requirements

### Requirement: Giao diện responsive
Mọi màn hình SHALL dùng được ở chiều rộng từ 360px tới màn hình máy tính, không có thanh cuộn ngang. Các vùng bấm trên màn hình của con MUST có kích thước tối thiểu 44x44px.

#### Scenario: Màn hình điện thoại
- **WHEN** ứng dụng được mở ở chiều rộng 360px
- **THEN** mọi nội dung và nút bấm hiển thị đầy đủ, không có thanh cuộn ngang

#### Scenario: Màn hình máy tính
- **WHEN** ứng dụng được mở ở chiều rộng 1280px
- **THEN** bố cục tận dụng chiều rộng mà không kéo giãn nội dung tới mức khó đọc

### Requirement: Bộ theme chibi
Hệ thống SHALL cung cấp ít nhất 3 theme. Mỗi theme gồm bảng màu tươi sáng và bộ hình minh họa chibi. Văn bản trong mọi theme MUST đạt tỷ lệ tương phản tối thiểu 4.5:1 với nền.

#### Scenario: Danh sách theme
- **WHEN** người dùng mở phần chọn theme
- **THEN** hệ thống hiển thị ít nhất 3 theme kèm ảnh xem trước

#### Scenario: Độ tương phản
- **WHEN** kiểm tra màu chữ và màu nền của từng theme
- **THEN** mọi cặp màu chữ/nền đạt tỷ lệ tương phản ít nhất 4.5:1

### Requirement: Theme mặc định của gia đình
Bố mẹ SHALL chọn theme mặc định cho gia đình. Màn hình của bố mẹ, màn hình chọn avatar, và màn hình của những con chưa tự chọn theme MUST dùng theme mặc định này.

#### Scenario: Đổi theme mặc định
- **WHEN** bố mẹ đổi theme mặc định của gia đình
- **THEN** màn hình bố mẹ, màn hình chọn avatar và màn hình của con chưa tự chọn theme chuyển sang theme mới

### Requirement: Con tự chọn theme
Con SHALL chọn theme cho màn hình riêng của mình. Lựa chọn của con MUST được ưu tiên hơn theme mặc định và được giữ giữa các lần đăng nhập. Con SHALL quay lại dùng theme mặc định của gia đình được.

#### Scenario: Con chọn theme
- **WHEN** con chọn một theme khác theme mặc định
- **THEN** màn hình của con dùng theme đó ở lần đăng nhập này và các lần sau, còn màn hình của người khác không đổi

#### Scenario: Về theme gia đình
- **WHEN** con chọn "Dùng theme của gia đình"
- **THEN** màn hình của con dùng theme mặc định của gia đình

### Requirement: Phản hồi trực quan khi điểm thay đổi
Khi con mở màn hình riêng và có giao dịch cộng điểm mới kể từ lần xem trước, hệ thống SHALL hiển thị hiệu ứng ăn mừng kèm tổng điểm vừa nhận. Hiệu ứng MUST bị tắt hoặc giản lược khi thiết bị bật chế độ giảm chuyển động.

#### Scenario: Có điểm mới
- **WHEN** con đăng nhập sau khi được duyệt một nhiệm vụ +15
- **THEN** màn hình hiển thị hiệu ứng ăn mừng và "+15" trước khi vào trang chính

#### Scenario: Giảm chuyển động
- **WHEN** thiết bị bật chế độ giảm chuyển động và con có điểm mới
- **THEN** hệ thống chỉ hiển thị thông báo "+15", không có hoạt ảnh

### Requirement: Màn hình chính của con
Màn hình chính của con SHALL hiển thị nổi bật: avatar, số dư kèm tên và icon đơn vị tiền tệ, thanh tiến độ tới mục tiêu (nếu có), và nhiệm vụ hôm nay.

#### Scenario: Mở màn hình chính
- **WHEN** con đăng nhập thành công
- **THEN** con thấy avatar, số dư với đơn vị tiền tệ của gia đình, mục tiêu cùng tiến độ, và danh sách nhiệm vụ hôm nay
