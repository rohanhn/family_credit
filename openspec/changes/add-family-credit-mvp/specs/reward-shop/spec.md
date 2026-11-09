# Spec Delta

## Purpose

Cho con một chỗ để tiêu điểm: một cửa hàng phần thưởng do bố mẹ định giá. Con gửi yêu cầu đổi, bố mẹ duyệt, và con có mục tiêu tiết kiệm để hướng tới.

## ADDED Requirements

### Requirement: Quản lý danh mục phần thưởng
Bố mẹ SHALL tạo, sửa, ẩn và hiện lại phần thưởng. Mỗi phần thưởng gồm tên, giá là số nguyên dương, icon hoặc hình chọn từ bộ có sẵn, và mô tả tùy chọn. Đổi giá MUST không ảnh hưởng tới các yêu cầu đổi đã được duyệt.

#### Scenario: Tạo phần thưởng
- **WHEN** bố mẹ tạo phần thưởng "30 phút chơi game" giá 50
- **THEN** phần thưởng xuất hiện trong cửa hàng của mọi con trong gia đình

#### Scenario: Ẩn phần thưởng
- **WHEN** bố mẹ ẩn một phần thưởng
- **THEN** con không còn thấy phần thưởng đó trong cửa hàng

### Requirement: Con xem cửa hàng
Con SHALL thấy các phần thưởng đang hiện kèm giá. Phần thưởng có giá lớn hơn số dư của con MUST được hiển thị là chưa đủ điểm, kèm số điểm còn thiếu.

#### Scenario: Đủ và chưa đủ điểm
- **WHEN** con có 60 điểm và cửa hàng có phần thưởng giá 50 và giá 200
- **THEN** phần thưởng giá 50 có nút "Đổi", còn phần thưởng giá 200 hiển thị "Còn thiếu 140"

### Requirement: Con gửi yêu cầu đổi thưởng
Con SHALL gửi yêu cầu đổi một phần thưởng đang hiện khi số dư lớn hơn hoặc bằng giá; số dư được so trực tiếp với giá, không trừ đi các yêu cầu khác đang chờ. Yêu cầu ghi lại tên và giá tại thời điểm gửi và có trạng thái "chờ duyệt". Gửi yêu cầu MUST NOT trừ điểm. Mỗi con MUST có tối đa một yêu cầu đang chờ duyệt cho mỗi phần thưởng. Con SHALL hủy được yêu cầu đang chờ duyệt.

#### Scenario: Gửi yêu cầu
- **WHEN** con có 60 điểm bấm "Đổi" phần thưởng giá 50
- **THEN** một yêu cầu "chờ duyệt" được tạo với giá 50, và số dư vẫn là 60

#### Scenario: Không đủ điểm
- **WHEN** con có 30 điểm cố đổi phần thưởng giá 50
- **THEN** hệ thống từ chối

#### Scenario: Đã có yêu cầu đang chờ cho phần thưởng đó
- **WHEN** con đã có một yêu cầu đang chờ duyệt cho "Kem ốc quế" và gửi thêm một yêu cầu nữa cho "Kem ốc quế"
- **THEN** hệ thống từ chối, và phần thưởng đó hiển thị "Chờ duyệt" thay cho nút "Đổi"

#### Scenario: Hủy yêu cầu
- **WHEN** con hủy một yêu cầu đang chờ duyệt
- **THEN** yêu cầu chuyển sang "đã hủy" và không có giao dịch nào được ghi

### Requirement: Bố mẹ duyệt yêu cầu đổi thưởng
Bố mẹ SHALL thấy các yêu cầu đổi đang chờ duyệt và duyệt hoặc từ chối (kèm lý do tùy chọn). Khi duyệt, hệ thống SHALL ghi giao dịch loại "đổi thưởng" trừ đúng giá đã ghi trong yêu cầu, với tên đã ghi trong yêu cầu. Bố mẹ SHALL duyệt hoặc từ chối được yêu cầu kể cả khi phần thưởng đã bị sửa hoặc bị ẩn sau khi con gửi. Nếu số dư lúc duyệt nhỏ hơn giá, hệ thống MUST từ chối thao tác duyệt.

#### Scenario: Duyệt yêu cầu
- **WHEN** bố mẹ duyệt yêu cầu đổi "30 phút chơi game" giá 50 của con đang có 60 điểm
- **THEN** yêu cầu chuyển sang "đã duyệt", sổ cái có thêm giao dịch -50 loại "đổi thưởng", số dư còn 10

#### Scenario: Số dư đã giảm trước khi duyệt
- **WHEN** con có hai yêu cầu chờ duyệt, mỗi cái giá 50, số dư 60, và bố mẹ đã duyệt yêu cầu thứ nhất
- **THEN** thao tác duyệt yêu cầu thứ hai bị từ chối vì số dư 10 không đủ, và bố mẹ được báo lý do

#### Scenario: Phần thưởng bị sửa hoặc ẩn trong lúc chờ
- **WHEN** con gửi yêu cầu đổi "Kem ốc quế" giá 80, sau đó bố mẹ đổi tên thành "Kem que", tăng giá lên 100 rồi ẩn phần thưởng, và cuối cùng duyệt yêu cầu
- **THEN** giao dịch trừ 80 với tên "Kem ốc quế"

#### Scenario: Từ chối yêu cầu
- **WHEN** bố mẹ từ chối một yêu cầu với lý do "Tối nay không chơi game"
- **THEN** yêu cầu chuyển sang "bị từ chối", con thấy lý do, và số dư không đổi

### Requirement: Mục tiêu tiết kiệm
Con SHALL chọn một phần thưởng đang hiện làm mục tiêu. Màn hình của con SHALL hiển thị tiến độ là số dư trên giá mục tiêu, giới hạn ở 100%. Nếu phần thưởng mục tiêu bị ẩn, mục tiêu MUST được bỏ chọn; hiện lại phần thưởng không tự chọn lại mục tiêu. Đổi thành công phần thưởng mục tiêu MUST NOT bỏ chọn mục tiêu.

#### Scenario: Chọn mục tiêu
- **WHEN** con có 40 điểm chọn phần thưởng "Đi công viên" giá 200 làm mục tiêu
- **THEN** màn hình con hiển thị tiến độ 20% và "Còn 160 nữa"

#### Scenario: Đạt mục tiêu
- **WHEN** số dư của con đạt hoặc vượt giá mục tiêu
- **THEN** tiến độ hiển thị 100% và nút "Đổi" nổi bật

#### Scenario: Mục tiêu bị ẩn
- **WHEN** bố mẹ ẩn phần thưởng đang là mục tiêu của một con
- **THEN** con đó không còn mục tiêu và được gợi ý chọn mục tiêu mới

#### Scenario: Đổi thành công phần thưởng mục tiêu
- **WHEN** bố mẹ duyệt yêu cầu đổi đúng phần thưởng đang là mục tiêu của con
- **THEN** phần thưởng đó vẫn là mục tiêu của con, và tiến độ tính lại theo số dư mới
