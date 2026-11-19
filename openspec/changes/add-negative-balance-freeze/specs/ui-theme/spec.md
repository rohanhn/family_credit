# Spec Delta

## MODIFIED Requirements

### Requirement: Bộ theme chibi
Hệ thống SHALL cung cấp ít nhất 3 theme. Mỗi theme gồm bảng màu tươi sáng và bộ hình minh họa chibi. Bảng màu đóng băng của capability `debt-freeze` là ngoại lệ có chủ đích với yêu cầu tươi sáng và không phải một theme để chọn. Văn bản trong mọi theme và trong bảng màu đóng băng MUST đạt tỷ lệ tương phản tối thiểu 4.5:1 với nền.

#### Scenario: Danh sách theme
- **WHEN** người dùng mở phần chọn theme
- **THEN** hệ thống hiển thị ít nhất 3 theme kèm ảnh xem trước, và không có bảng màu đóng băng trong danh sách

#### Scenario: Độ tương phản
- **WHEN** kiểm tra màu chữ và màu nền của từng theme và của bảng màu đóng băng
- **THEN** mọi cặp màu chữ/nền đạt tỷ lệ tương phản ít nhất 4.5:1

### Requirement: Màn báo khi bị trừ điểm
Khi có giao dịch trừ điểm mới kể từ lần xem trước, hệ thống SHALL hiển thị một thông báo nhẹ nhàng kèm tổng điểm bị trừ, lý do, người thực hiện và số dư còn lại. Khi số dư hiện tại nhỏ hơn 0, phần số dư còn lại SHALL hiện dạng "Con đang nợ X" kèm lời nhắc kiếm điểm để tan băng. Thông báo này MUST NOT dùng hiệu ứng ăn mừng.

#### Scenario: Bị trừ điểm
- **WHEN** con đăng nhập sau khi bị áp dụng rule phạt "Nói dối" 10 điểm
- **THEN** màn hình hiển thị thông báo "−10" kèm lý do "Nói dối", người thực hiện và số dư còn lại, không có confetti, và con bấm "Con hiểu rồi" để vào trang chính

#### Scenario: Bị trừ điểm thành nợ
- **WHEN** con có 5 điểm và đăng nhập sau khi bị áp dụng rule phạt "Nói dối" 20 điểm
- **THEN** màn hình hiển thị "−20" kèm lý do "Nói dối", người thực hiện, dòng "Con đang nợ 15" và lời nhắc kiếm điểm để tan băng, không có confetti

### Requirement: Màn hình chính của con
Màn hình chính của con SHALL hiển thị nổi bật: avatar, số dư kèm tên và icon đơn vị tiền tệ, thanh tiến độ tới mục tiêu (nếu có), và nhiệm vụ hôm nay. Khi con đang nợ, số dư, thanh tiến độ và phần động viên SHALL theo capability `debt-freeze` ("Hiển thị số nợ", "Thanh tan băng", "Động viên và lối tắt kiếm điểm").

#### Scenario: Mở màn hình chính
- **WHEN** con đăng nhập thành công
- **THEN** con thấy avatar, số dư với đơn vị tiền tệ của gia đình, mục tiêu cùng tiến độ, và danh sách nhiệm vụ hôm nay

#### Scenario: Mở màn hình chính khi đang nợ
- **WHEN** con đang nợ 15 và đăng nhập thành công
- **THEN** con thấy avatar với nét mặt lạnh, "Đang nợ 15" với đơn vị tiền tệ, thanh tan băng thay cho thanh mục tiêu, lời động viên và danh sách nhiệm vụ hôm nay
