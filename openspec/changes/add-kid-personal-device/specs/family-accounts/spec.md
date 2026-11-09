## MODIFIED Requirements

### Requirement: Đăng nhập con bằng avatar và PIN
Trên thiết bị đã được bố mẹ kích hoạt "chế độ gia đình" hoặc "máy riêng của con", hệ thống SHALL hiển thị avatar của các con được phép đăng nhập trên thiết bị đó và cho con đăng nhập bằng PIN. Nhập sai 5 lần liên tiếp MUST khóa đăng nhập của con đó trong 5 phút.

#### Scenario: Kích hoạt chế độ gia đình
- **WHEN** bố mẹ đã đăng nhập bật "chế độ gia đình" trên một thiết bị
- **THEN** thiết bị đó hiển thị màn hình chọn avatar của các con trong gia đình mà không cần bố mẹ đăng nhập lại

#### Scenario: Con nhập đúng PIN
- **WHEN** con chọn avatar của mình và nhập đúng PIN
- **THEN** hệ thống mở màn hình riêng của con đó

#### Scenario: Nhập sai PIN quá nhiều lần
- **WHEN** PIN của một con bị nhập sai 5 lần liên tiếp
- **THEN** đăng nhập của con đó bị khóa 5 phút và màn hình hiển thị thông báo thân thiện

### Requirement: Phân quyền bố mẹ và con
Hệ thống MUST giới hạn mọi dữ liệu trong phạm vi gia đình của người dùng. Phiên của con MUST chỉ xem được dữ liệu của chính con đó và chỉ thực hiện được các thao tác của con (báo xong nhiệm vụ, khai rule thưởng, xin đổi thưởng, chọn mục tiêu, chọn theme, đọc thông báo, đổi PIN của chính mình).

#### Scenario: Truy cập dữ liệu gia đình khác
- **WHEN** một người dùng yêu cầu dữ liệu thuộc gia đình khác
- **THEN** hệ thống từ chối như thể dữ liệu không tồn tại

#### Scenario: Con cố thực hiện thao tác của bố mẹ
- **WHEN** phiên của con gửi yêu cầu cộng/trừ điểm, sửa rule, hoặc duyệt yêu cầu
- **THEN** hệ thống từ chối

#### Scenario: Con xem dữ liệu của anh chị em
- **WHEN** phiên của con yêu cầu số dư hoặc lịch sử của một con khác
- **THEN** hệ thống từ chối

#### Scenario: Thoát về màn hình chọn avatar
- **WHEN** con bấm "Thoát" trên màn hình riêng
- **THEN** phiên của con kết thúc và thiết bị quay về màn hình chọn avatar

## ADDED Requirements

### Requirement: Máy riêng của con
Bố mẹ đã đăng nhập SHALL bật được một thiết bị thành "máy riêng" của đúng một con chưa lưu trữ. Trên máy riêng, chỉ con đó MUST đăng nhập được. Bật xong, phiên bố mẹ trên thiết bị đó MUST kết thúc. Phiên của máy riêng SHALL tự gia hạn khi còn dùng. Bố mẹ SHALL thấy và thu hồi được từng máy riêng; lưu trữ con MUST thu hồi các máy riêng của con đó.

#### Scenario: Bật máy riêng
- **WHEN** bố mẹ đăng nhập trên điện thoại của Bin và bật "Máy riêng của Bin"
- **THEN** điện thoại chỉ hiển thị avatar của Bin để nhập PIN, và không còn phiên bố mẹ trên điện thoại đó

#### Scenario: Con khác không đăng nhập được trên máy riêng
- **WHEN** có yêu cầu đăng nhập PIN cho Na trên máy riêng của Bin, kể cả với PIN đúng của Na
- **THEN** hệ thống từ chối

#### Scenario: Danh sách thiết bị
- **WHEN** bố mẹ mở danh sách thiết bị trong cài đặt
- **THEN** mỗi thiết bị ghi rõ "Máy dùng chung" hoặc "Máy riêng của <tên con>", kèm thời điểm bật, và có nút thu hồi

#### Scenario: Máy riêng vẫn dùng được sau thời gian dài
- **WHEN** con dùng máy riêng đều đặn hơn 90 ngày
- **THEN** máy riêng vẫn còn hiệu lực mà bố mẹ không cần bật lại

#### Scenario: Lưu trữ con có máy riêng
- **WHEN** bố mẹ lưu trữ Bin
- **THEN** máy riêng của Bin bị thu hồi và hiển thị màn hình "Thiết bị chưa bật chế độ gia đình"

### Requirement: Nhập PIN mỗi lần mở trên máy riêng
Trên máy riêng, phiên của con SHALL kéo dài tới khi trình duyệt hoặc ứng dụng bị đóng hẳn; mở lại thì con MUST nhập PIN. Trong lúc trình duyệt hoặc ứng dụng còn mở, phiên MUST NOT hết hạn chỉ vì đã quá 2 giờ.

#### Scenario: Mở lại sau khi đóng hẳn
- **WHEN** con đăng nhập trên máy riêng, đóng hẳn trình duyệt rồi mở lại ứng dụng
- **THEN** hệ thống yêu cầu con nhập PIN

#### Scenario: Chuyển app rồi quay lại
- **WHEN** con chuyển sang ứng dụng khác 3 giờ rồi quay lại khi trình duyệt chưa bị đóng
- **THEN** con vẫn ở màn hình riêng mà không phải nhập PIN

### Requirement: Con đổi PIN
Con đã đăng nhập SHALL đổi được PIN của mình bằng cách nhập PIN hiện tại và PIN mới hai lần. PIN mới MUST gồm đúng 4 chữ số và khác PIN hiện tại, và áp dụng cho mọi thiết bị. Nhập sai PIN hiện tại MUST được tính vào bộ đếm khóa đăng nhập của con. Bố mẹ SHALL vẫn đặt lại được PIN của con. Mỗi lần đổi hoặc đặt lại PIN MUST được ghi log bảo mật, và bố mẹ SHALL thấy thời điểm PIN được đổi lần cuối.

#### Scenario: Đổi PIN thành công
- **WHEN** con nhập đúng PIN hiện tại và nhập PIN mới hợp lệ hai lần giống nhau
- **THEN** PIN mới có hiệu lực ở lần đăng nhập tiếp theo trên mọi thiết bị, PIN cũ không còn dùng được, và phiên hiện tại của con vẫn giữ

#### Scenario: Sai PIN hiện tại
- **WHEN** con nhập sai PIN hiện tại khi đổi PIN
- **THEN** hệ thống từ chối, PIN không đổi, và lần sai được tính vào bộ đếm 5 lần

#### Scenario: PIN mới không hợp lệ
- **WHEN** PIN mới không gồm đúng 4 chữ số, trùng PIN hiện tại, hoặc hai lần nhập không giống nhau
- **THEN** hệ thống từ chối và báo lý do

#### Scenario: Bố mẹ đặt lại PIN khi con quên
- **WHEN** bố mẹ đặt PIN mới cho con trong phần sửa hồ sơ
- **THEN** con đăng nhập được bằng PIN mới, và cài đặt hiển thị thời điểm PIN được đổi lần cuối

### Requirement: Lối vào ứng dụng
Trang gốc của ứng dụng SHALL đưa người dùng tới đúng nơi theo trạng thái của thiết bị: phiên con còn hiệu lực thì tới màn hình riêng của con; thiết bị đã bật chế độ gia đình hoặc máy riêng thì tới màn đăng nhập của con; phiên bố mẹ còn hiệu lực thì tới khu vực bố mẹ; còn lại thì tới trang đăng nhập.

#### Scenario: Mở ứng dụng trên máy riêng
- **WHEN** con mở trang gốc trên máy riêng khi chưa đăng nhập
- **THEN** hệ thống đưa con tới màn nhập PIN của con

#### Scenario: Thiết bị chưa thiết lập
- **WHEN** một thiết bị không có phiên nào mở trang gốc
- **THEN** hệ thống đưa tới trang đăng nhập của bố mẹ
