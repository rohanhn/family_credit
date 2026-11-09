## MODIFIED Requirements

### Requirement: Quản lý hồ sơ con
Bố mẹ SHALL tạo, sửa và lưu trữ hồ sơ con, gồm tên hiển thị, avatar chọn từ bộ có sẵn và PIN 4 chữ số. Hồ sơ đã lưu trữ MUST không còn hiện ở màn hình chọn avatar, nhưng lịch sử giao dịch vẫn được giữ. Bố mẹ MUST NOT ghi được điểm thưởng hoặc phạt mới cho con đã lưu trữ; các yêu cầu con đã gửi trước khi bị lưu trữ vẫn SHALL được duyệt hoặc từ chối, và giao dịch điều chỉnh vẫn ghi được để sửa sai.

#### Scenario: Tạo hồ sơ con
- **WHEN** bố mẹ nhập tên, chọn avatar và đặt PIN 4 chữ số
- **THEN** hồ sơ con được tạo với số dư 0 và hiện trên màn hình chọn avatar của gia đình

#### Scenario: PIN không hợp lệ
- **WHEN** bố mẹ đặt PIN không gồm đúng 4 chữ số
- **THEN** hệ thống từ chối và báo định dạng PIN

#### Scenario: Lưu trữ hồ sơ con
- **WHEN** bố mẹ lưu trữ một hồ sơ con
- **THEN** con đó không còn đăng nhập được, còn lịch sử giao dịch vẫn xem được từ phía bố mẹ

#### Scenario: Không ghi điểm mới cho con đã lưu trữ
- **WHEN** bố mẹ áp dụng rule hoặc thưởng/phạt đột xuất cho một con đã lưu trữ
- **THEN** hệ thống từ chối và số dư của con không đổi

#### Scenario: Yêu cầu gửi trước khi lưu trữ
- **WHEN** con khai một rule thưởng, sau đó bị lưu trữ trước khi bố mẹ duyệt
- **THEN** yêu cầu vẫn nằm trong hàng chờ duyệt với tên con kèm nhãn "đã lưu trữ", và bố mẹ duyệt hoặc từ chối được
