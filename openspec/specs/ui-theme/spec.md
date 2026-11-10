# ui-theme Specification

## Purpose

Đảm bảo ứng dụng dùng tốt trên điện thoại, máy tính bảng và máy tính, có giao diện tươi sáng phong cách chibi hấp dẫn trẻ, cho phép đổi theme, và phản hồi trực quan khi điểm thay đổi.

## Requirements

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

### Requirement: Màn ăn mừng khi được cộng điểm
Khi con mở màn hình riêng và có giao dịch cộng điểm mới kể từ lần xem trước, hệ thống SHALL hiển thị hiệu ứng ăn mừng kèm tổng điểm vừa nhận và danh sách từng khoản.

#### Scenario: Có điểm mới
- **WHEN** con đăng nhập sau khi được duyệt một nhiệm vụ +15
- **THEN** màn hình hiển thị hiệu ứng ăn mừng và "+15" trước khi vào trang chính

### Requirement: Màn báo khi bị trừ điểm
Khi có giao dịch trừ điểm mới kể từ lần xem trước, hệ thống SHALL hiển thị một thông báo nhẹ nhàng kèm tổng điểm bị trừ, lý do, người thực hiện và số dư còn lại. Thông báo này MUST NOT dùng hiệu ứng ăn mừng.

#### Scenario: Bị trừ điểm
- **WHEN** con đăng nhập sau khi bị áp dụng rule phạt "Nói dối" 10 điểm
- **THEN** màn hình hiển thị thông báo "−10" kèm lý do "Nói dối", người thực hiện và số dư còn lại, không có confetti, và con bấm "Con hiểu rồi" để vào trang chính

### Requirement: Thứ tự hiển thị phản hồi điểm
Khi con có cả giao dịch cộng điểm và trừ điểm mới, màn ăn mừng SHALL hiện trước, màn báo trừ điểm hiện sau.

#### Scenario: Vừa được cộng vừa bị trừ
- **WHEN** từ lần xem trước con có một giao dịch +15 và một giao dịch −10
- **THEN** thông báo "+15" hiện trước, sau đó là thông báo "−10"

### Requirement: Giảm chuyển động
Hiệu ứng của màn ăn mừng và màn báo trừ điểm MUST bị tắt hoặc giản lược khi thiết bị bật chế độ giảm chuyển động.

#### Scenario: Giảm chuyển động
- **WHEN** thiết bị bật chế độ giảm chuyển động và con có điểm mới
- **THEN** hệ thống chỉ hiển thị thông báo "+15", không có hoạt ảnh

### Requirement: Âm thanh phản hồi
Hệ thống SHALL phát hiệu ứng âm thanh ngắn khi: con thấy thông báo được cộng điểm (âm thưởng), con thấy thông báo bị trừ điểm (âm phạt, nhẹ và trầm, không phải tiếng báo lỗi), con báo xong nhiệm vụ, yêu cầu đổi thưởng của con được duyệt, và bố mẹ ghi thưởng hoặc phạt. Âm thanh MUST NOT là cách duy nhất truyền đạt thông tin. Người dùng SHALL tắt hoặc bật âm thanh trên từng thiết bị, và lựa chọn được giữ giữa các lần đăng nhập. Bố mẹ SHALL tắt âm thanh cho cả gia đình (mặc định bật).

#### Scenario: Âm thanh khi được thưởng
- **WHEN** con mở màn hình riêng và có giao dịch cộng điểm mới, âm thanh đang bật
- **THEN** hệ thống phát âm thưởng cùng lúc hiển thị thông báo cộng điểm

#### Scenario: Âm thanh khi bị phạt
- **WHEN** bố mẹ bấm ghi phạt cho một con, âm thanh đang bật
- **THEN** hệ thống phát âm phạt và hiển thị xác nhận đã ghi bằng chữ

#### Scenario: Tắt âm thanh trên thiết bị
- **WHEN** con bấm nút loa để tắt âm thanh rồi thoát và đăng nhập lại trên cùng thiết bị
- **THEN** âm thanh vẫn tắt, còn thông báo bằng chữ và hình vẫn hiển thị đầy đủ

#### Scenario: Bố mẹ tắt âm thanh cả gia đình
- **WHEN** bố mẹ tắt âm thanh trong cài đặt gia đình
- **THEN** không thiết bị nào trong gia đình phát âm thanh

#### Scenario: Trình duyệt chặn phát âm thanh
- **WHEN** trình duyệt chưa cho phép phát âm thanh vì người dùng chưa thao tác
- **THEN** thông báo vẫn hiển thị bình thường, không có lỗi, và âm thanh phát được từ lần chạm tiếp theo

### Requirement: Màn hình chính của con
Màn hình chính của con SHALL hiển thị nổi bật: avatar, số dư kèm tên và icon đơn vị tiền tệ, thanh tiến độ tới mục tiêu (nếu có), và nhiệm vụ hôm nay.

#### Scenario: Mở màn hình chính
- **WHEN** con đăng nhập thành công
- **THEN** con thấy avatar, số dư với đơn vị tiền tệ của gia đình, mục tiêu cùng tiến độ, và danh sách nhiệm vụ hôm nay

### Requirement: Cài ứng dụng lên màn hình chính
Ứng dụng SHALL cung cấp thông tin để trình duyệt di động cho phép "Thêm vào màn hình chính": tên ứng dụng, icon và màu theme. Mở từ màn hình chính SHALL vào trang gốc của ứng dụng và hiển thị ở chế độ toàn màn hình, không có thanh địa chỉ.

#### Scenario: Thêm vào màn hình chính
- **WHEN** con dùng trình duyệt trên điện thoại chọn "Thêm vào màn hình chính"
- **THEN** màn hình chính có icon của ứng dụng với tên ứng dụng

#### Scenario: Mở từ màn hình chính
- **WHEN** con mở ứng dụng từ icon trên màn hình chính
- **THEN** ứng dụng mở ở chế độ toàn màn hình tại trang gốc và đưa con tới đúng nơi theo trạng thái thiết bị
