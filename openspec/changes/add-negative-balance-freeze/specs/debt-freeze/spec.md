# Spec Delta

## Purpose

Định nghĩa trạng thái nợ của con khi số dư nhỏ hơn 0 và cách hệ thống thể hiện trạng thái đó: giao diện đóng băng, lời động viên và lối tắt kiếm điểm cho con, khoảnh khắc tan băng khi hết nợ, và dấu hiệu cho bố mẹ biết con nào đang nợ.

## ADDED Requirements

### Requirement: Trạng thái nợ
Một con SHALL ở trạng thái nợ khi và chỉ khi số dư của con nhỏ hơn 0. Số nợ là giá trị tuyệt đối của số dư. Số dư bằng 0 MUST NOT được coi là nợ. Trạng thái nợ MUST luôn khớp với số dư hiện tại, không cần thao tác riêng để vào hay ra.

#### Scenario: Bị phạt thành nợ
- **WHEN** con có 5 điểm và bị phạt 20 điểm
- **THEN** số dư là −15 và con ở trạng thái nợ với số nợ 15

#### Scenario: Số dư bằng 0
- **WHEN** con có 10 điểm và bị phạt đúng 10 điểm
- **THEN** số dư là 0 và con không ở trạng thái nợ

#### Scenario: Kiếm đủ điểm thì hết nợ
- **WHEN** con đang nợ 15 và được duyệt một nhiệm vụ +20
- **THEN** số dư là 5 và con không còn ở trạng thái nợ

### Requirement: Giao diện đóng băng
Khi con đang nợ, mọi màn hình trong khu vực của con SHALL dùng giao diện đóng băng: một bảng màu băng dùng chung cho mọi con, thay tạm thời theme con đã chọn, và avatar chibi mang nét mặt lạnh. Theme con đã chọn MUST được giữ nguyên và dùng lại khi con hết nợ. Bảng màu băng MUST NOT xuất hiện trong danh sách theme để chọn.

#### Scenario: Con đăng nhập khi đang nợ
- **WHEN** con đã chọn theme "Biển xanh", đang nợ 15 và đăng nhập
- **THEN** mọi màn hình của con dùng bảng màu băng và avatar mang nét mặt lạnh

#### Scenario: Hết nợ thì về theme cũ
- **WHEN** con đã chọn theme "Biển xanh", đang nợ, rồi số dư về 0 trở lên
- **THEN** màn hình của con dùng lại theme "Biển xanh"

#### Scenario: Đổi theme khi đang nợ
- **WHEN** con đang nợ mở màn chọn theme và chọn "Kẹo ngọt"
- **THEN** lựa chọn được lưu, màn hình vẫn dùng bảng màu băng cho tới khi hết nợ, rồi dùng "Kẹo ngọt"

#### Scenario: Bị phạt thành nợ khi đang mở app
- **WHEN** con đang mở màn hình riêng và bố mẹ ghi một khoản phạt làm số dư của con nhỏ hơn 0 trên thiết bị khác
- **THEN** trong vòng 30 giây màn hình của con chuyển sang giao diện đóng băng

### Requirement: Hiển thị số nợ
Khi con đang nợ, các chỗ hiển thị số dư trên màn hình của con SHALL hiện dạng "Đang nợ X" kèm đơn vị tiền tệ, với X là số nợ, thay cho một số âm.

#### Scenario: Số dư trên màn hình chính
- **WHEN** con có số dư −15 với đơn vị "Sao" và mở màn hình chính
- **THEN** ô số dư hiện "Đang nợ 15 Sao", không hiện "−15"

### Requirement: Thanh tan băng
Khi con đang nợ, màn hình chính SHALL hiện thanh tiến độ "tan băng" ở chỗ của thanh mục tiêu tiết kiệm. Mốc đầu của thanh là số nợ lớn nhất kể từ lần gần nhất số dư của con từ 0 trở lên; tiến độ là phần nợ đã trả được so với mốc đó, kèm số điểm còn cần để tan băng.

#### Scenario: Đã trả được một phần nợ
- **WHEN** con có 0 điểm, bị phạt 20 (nợ 20), rồi được cộng 5 (nợ 15)
- **THEN** thanh tan băng hiện 25% và "Còn 15 nữa là tan băng"

#### Scenario: Nợ sâu thêm
- **WHEN** con đang nợ 15 với mốc 20 và bị phạt thêm 10
- **THEN** mốc đầu thành 25, thanh hiện 0% và "Còn 25 nữa là tan băng"

#### Scenario: Vừa vào trạng thái nợ
- **WHEN** con có 5 điểm và bị phạt 20
- **THEN** thanh tan băng hiện 0% và "Còn 15 nữa là tan băng"

### Requirement: Động viên và lối tắt kiếm điểm
Khi con đang nợ, màn hình chính SHALL hiện một lời động viên và lối tắt tới các cách kiếm điểm của con: nhiệm vụ hôm nay còn làm được, danh sách rule thưởng để khai, và đề xuất xin thưởng. Nếu các nhiệm vụ hôm nay còn làm được có tổng điểm đủ trả hết nợ, lời động viên SHALL nói rõ con cần làm ít nhất bao nhiêu nhiệm vụ để tan băng. Lời động viên MUST NOT trách mắng hoặc so sánh con với người khác.

#### Scenario: Nhiệm vụ hôm nay đủ trả nợ
- **WHEN** con đang nợ 15 và hôm nay còn hai nhiệm vụ chưa làm, mỗi nhiệm vụ 10 điểm
- **THEN** màn hình chính hiện lời động viên "Làm 2 nhiệm vụ hôm nay là tan băng rồi!" và lối tắt tới hai nhiệm vụ đó

#### Scenario: Nhiệm vụ hôm nay không đủ trả nợ
- **WHEN** con đang nợ 50 và hôm nay chỉ còn một nhiệm vụ 10 điểm
- **THEN** màn hình chính hiện một lời động viên chung không nêu số nhiệm vụ, cùng lối tắt tới nhiệm vụ đó, rule thưởng và đề xuất xin thưởng

#### Scenario: Không còn nhiệm vụ hôm nay
- **WHEN** con đang nợ và đã báo xong mọi nhiệm vụ hôm nay
- **THEN** màn hình chính hiện lời động viên cùng lối tắt tới rule thưởng và đề xuất xin thưởng

### Requirement: Được cộng điểm khi còn nợ
Khi con được cộng điểm mà số dư sau đó vẫn nhỏ hơn 0, màn ăn mừng SHALL hiện như bình thường, kèm số nợ còn lại.

#### Scenario: Trả được một phần nợ
- **WHEN** con đang nợ 15 và được duyệt một nhiệm vụ +10
- **THEN** màn ăn mừng hiện "+10" kèm dòng "Con còn nợ 5 nữa thôi"

### Requirement: Màn tan băng
Khi một khoản cộng điểm đưa số dư của con từ dưới 0 lên 0 trở lên, màn ăn mừng của khoản đó SHALL hiện ở dạng "Tan băng rồi!" thay cho tiêu đề thường, và màn hình của con trở lại theme con đã chọn. Nếu lúc con xem màn ăn mừng số dư đã lại nhỏ hơn 0, màn ăn mừng MUST hiện dạng thường, không có "Tan băng rồi!".

#### Scenario: Tan băng
- **WHEN** con đang nợ 5 và được duyệt một nhiệm vụ +10
- **THEN** màn ăn mừng hiện "Tan băng rồi!" và "+10"; sau khi con bấm "Nhận quà", màn hình dùng theme con đã chọn

#### Scenario: Tan băng rồi lại bị phạt trước khi xem
- **WHEN** con đang nợ 5, được cộng 10, rồi bị phạt 20 trước khi mở app
- **THEN** màn ăn mừng hiện "+10" ở dạng thường, sau đó là màn báo bị trừ điểm, và màn hình vẫn đóng băng

### Requirement: Bố mẹ thấy con đang nợ
Ở trang tổng quan của bố mẹ, mỗi con đang nợ SHALL được đánh dấu "đang nợ" kèm số nợ, thay cho số dư âm.

#### Scenario: Trang tổng quan
- **WHEN** bố mẹ mở trang tổng quan và một con có số dư −15
- **THEN** thẻ của con đó hiện dấu "đang nợ" và số nợ 15

### Requirement: Báo trước khi phạt thành nợ
Trước khi bố mẹ ghi một khoản phạt (áp dụng rule phạt, phạt đột xuất, duyệt đề xuất tự nhận phạt) làm số dư của con nhỏ hơn 0, màn thao tác SHALL hiện số dư dự kiến sau khi phạt dưới dạng "sẽ nợ X". Lời báo này MUST NOT chặn thao tác.

#### Scenario: Áp dụng rule phạt thành nợ
- **WHEN** bố mẹ chọn rule phạt 20 điểm cho con đang có 5 điểm
- **THEN** màn Thưởng/Phạt hiện "Sau khi phạt, con sẽ nợ 15", và bố mẹ vẫn ghi được

#### Scenario: Duyệt đề xuất tự nhận phạt thành nợ
- **WHEN** hàng chờ duyệt có đề xuất tự nhận phạt 10 điểm của con đang có 4 điểm
- **THEN** đề xuất hiện "Nếu duyệt, con sẽ nợ 6"
