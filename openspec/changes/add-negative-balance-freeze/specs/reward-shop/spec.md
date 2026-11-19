# Spec Delta

## MODIFIED Requirements

### Requirement: Con xem cửa hàng
Con SHALL thấy các phần thưởng đang hiện kèm giá. Phần thưởng có giá lớn hơn số dư của con MUST được hiển thị là chưa đủ điểm, kèm số điểm còn thiếu. Khi con đang nợ, cửa hàng SHALL hiện trạng thái đóng băng kèm số nợ, mọi phần thưởng hiện là đang bị khóa thay cho nút "Đổi" hoặc "Còn thiếu X", và con vẫn xem được phần thưởng.

#### Scenario: Đủ và chưa đủ điểm
- **WHEN** con có 60 điểm và cửa hàng có phần thưởng giá 50 và giá 200
- **THEN** phần thưởng giá 50 có nút "Đổi", còn phần thưởng giá 200 hiển thị "Còn thiếu 140"

#### Scenario: Cửa hàng khi đang nợ
- **WHEN** con đang nợ 15 và mở cửa hàng có phần thưởng giá 50
- **THEN** cửa hàng hiện "Cửa hàng đang đóng băng" kèm số nợ 15, phần thưởng giá 50 hiện là đang bị khóa và không có nút "Đổi"

### Requirement: Con gửi yêu cầu đổi thưởng
Con SHALL gửi yêu cầu đổi một phần thưởng đang hiện khi số dư lớn hơn hoặc bằng giá; số dư được so trực tiếp với giá, không trừ đi các yêu cầu khác đang chờ. Yêu cầu ghi lại tên và giá tại thời điểm gửi và có trạng thái "chờ duyệt". Gửi yêu cầu MUST NOT trừ điểm. Mỗi con MUST có tối đa một yêu cầu đang chờ duyệt cho mỗi phần thưởng. Con SHALL hủy được yêu cầu đang chờ duyệt, trừ khi con đang nợ. Khi con đang nợ, hệ thống MUST từ chối cả gửi lẫn hủy yêu cầu và báo là cửa hàng đang đóng băng.

#### Scenario: Gửi yêu cầu
- **WHEN** con có 60 điểm bấm "Đổi" phần thưởng giá 50
- **THEN** một yêu cầu "chờ duyệt" được tạo với giá 50, và số dư vẫn là 60

#### Scenario: Không đủ điểm
- **WHEN** con có 30 điểm cố đổi phần thưởng giá 50
- **THEN** hệ thống từ chối

#### Scenario: Gửi yêu cầu khi đang nợ
- **WHEN** phiên của một con đang nợ gửi yêu cầu đổi một phần thưởng
- **THEN** hệ thống từ chối và báo cửa hàng đang đóng băng cho tới khi con hết nợ

#### Scenario: Đã có yêu cầu đang chờ cho phần thưởng đó
- **WHEN** con đã có một yêu cầu đang chờ duyệt cho "Kem ốc quế" và gửi thêm một yêu cầu nữa cho "Kem ốc quế"
- **THEN** hệ thống từ chối, và phần thưởng đó hiển thị "Chờ duyệt" thay cho nút "Đổi"

#### Scenario: Hủy yêu cầu
- **WHEN** con hủy một yêu cầu đang chờ duyệt
- **THEN** yêu cầu chuyển sang "đã hủy" và không có giao dịch nào được ghi

#### Scenario: Hủy yêu cầu khi đang nợ
- **WHEN** con có một yêu cầu đang chờ duyệt, bị phạt thành nợ, rồi mở cửa hàng
- **THEN** yêu cầu hiện là "đang đóng băng" và không có nút hủy; nếu phiên của con vẫn gửi lệnh hủy thì hệ thống từ chối và yêu cầu vẫn "chờ duyệt"

### Requirement: Bố mẹ duyệt yêu cầu đổi thưởng
Bố mẹ SHALL thấy các yêu cầu đổi đang chờ duyệt và duyệt hoặc từ chối (kèm lý do tùy chọn). Khi duyệt, hệ thống SHALL ghi giao dịch loại "đổi thưởng" trừ đúng giá đã ghi trong yêu cầu, với tên đã ghi trong yêu cầu. Bố mẹ SHALL duyệt hoặc từ chối được yêu cầu kể cả khi phần thưởng đã bị sửa hoặc bị ẩn sau khi con gửi. Nếu số dư lúc duyệt nhỏ hơn giá, hệ thống MUST từ chối thao tác duyệt. Khi con đang nợ, yêu cầu bị đóng băng: hệ thống MUST từ chối cả duyệt lẫn từ chối, trừ khi con đã được lưu trữ thì bố mẹ vẫn từ chối được. Yêu cầu bị đóng băng giữ trạng thái "chờ duyệt" và xử lý được bình thường khi con hết nợ.

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

#### Scenario: Yêu cầu đóng băng trong hàng chờ
- **WHEN** con có yêu cầu đổi đang chờ duyệt và đang nợ 15, rồi bố mẹ mở hàng chờ duyệt
- **THEN** yêu cầu hiện nhãn "Đang đóng băng: con đang nợ 15", nút duyệt và nút từ chối đều bị khóa

#### Scenario: Gửi lệnh duyệt hoặc từ chối khi đang nợ
- **WHEN** bố mẹ gửi lệnh duyệt hoặc từ chối một yêu cầu của con đang nợ
- **THEN** hệ thống từ chối thao tác, báo yêu cầu đang đóng băng, yêu cầu vẫn "chờ duyệt" và không có giao dịch hay thông báo nào được tạo

#### Scenario: Hết nợ thì xử lý lại được
- **WHEN** yêu cầu giá 50 đang đóng băng, rồi con được cộng điểm tới số dư 60
- **THEN** bố mẹ duyệt được yêu cầu như bình thường

#### Scenario: Hết nợ nhưng chưa đủ điểm
- **WHEN** yêu cầu giá 50 đang đóng băng, rồi con được cộng điểm tới số dư 10
- **THEN** yêu cầu hết đóng băng, bố mẹ từ chối được, còn thao tác duyệt bị từ chối vì số dư không đủ

#### Scenario: Con đã lưu trữ đang nợ
- **WHEN** con có yêu cầu đang chờ duyệt, đang nợ, và đã được lưu trữ
- **THEN** bố mẹ từ chối được yêu cầu đó, còn thao tác duyệt vẫn bị từ chối

### Requirement: Mục tiêu tiết kiệm
Con SHALL chọn một phần thưởng đang hiện làm mục tiêu, kể cả khi đang nợ. Màn hình của con SHALL hiển thị tiến độ là số dư trên giá mục tiêu, giới hạn trong khoảng 0% đến 100%; số điểm còn thiếu tính từ số dư hiện tại, kể cả khi số dư nhỏ hơn 0. Nếu phần thưởng mục tiêu bị ẩn, mục tiêu MUST được bỏ chọn; hiện lại phần thưởng không tự chọn lại mục tiêu. Đổi thành công phần thưởng mục tiêu MUST NOT bỏ chọn mục tiêu.

#### Scenario: Chọn mục tiêu
- **WHEN** con có 40 điểm chọn phần thưởng "Đi công viên" giá 200 làm mục tiêu
- **THEN** màn hình con hiển thị tiến độ 20% và "Còn 160 nữa"

#### Scenario: Đạt mục tiêu
- **WHEN** số dư của con đạt hoặc vượt giá mục tiêu
- **THEN** tiến độ hiển thị 100% và nút "Đổi" nổi bật

#### Scenario: Mục tiêu khi đang nợ
- **WHEN** con đang nợ 15 và có mục tiêu giá 50
- **THEN** tiến độ mục tiêu là 0% và số điểm còn thiếu là 65

#### Scenario: Mục tiêu bị ẩn
- **WHEN** bố mẹ ẩn phần thưởng đang là mục tiêu của một con
- **THEN** con đó không còn mục tiêu và được gợi ý chọn mục tiêu mới

#### Scenario: Đổi thành công phần thưởng mục tiêu
- **WHEN** bố mẹ duyệt yêu cầu đổi đúng phần thưởng đang là mục tiêu của con
- **THEN** phần thưởng đó vẫn là mục tiêu của con, và tiến độ tính lại theo số dư mới
