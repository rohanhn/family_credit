# Spec Delta

## Purpose

Quản lý gia đình như một không gian dữ liệu riêng, tài khoản bố mẹ, hồ sơ con và cách mỗi người đăng nhập, để mọi chức năng khác biết ai đang thao tác và với quyền gì.

## ADDED Requirements

### Requirement: Đăng ký tài khoản bố mẹ
Hệ thống SHALL cho phép một người đăng ký tài khoản bố mẹ bằng email và mật khẩu. Email MUST là duy nhất trong toàn hệ thống. Mật khẩu MUST có tối thiểu 8 ký tự. Mỗi địa chỉ IP MUST tạo tối đa 5 tài khoản trong một giờ.

#### Scenario: Đăng ký thành công
- **WHEN** người dùng đăng ký với email chưa tồn tại và mật khẩu 8 ký tự trở lên
- **THEN** hệ thống tạo tài khoản bố mẹ và đăng nhập người đó

#### Scenario: Email đã tồn tại
- **WHEN** người dùng đăng ký với email đã có tài khoản
- **THEN** hệ thống từ chối và báo email đã được sử dụng

#### Scenario: Mật khẩu quá ngắn
- **WHEN** người dùng đăng ký với mật khẩu dưới 8 ký tự
- **THEN** hệ thống từ chối và báo yêu cầu độ dài mật khẩu

#### Scenario: Đăng ký quá nhiều
- **WHEN** cùng một địa chỉ IP gửi yêu cầu đăng ký tài khoản thứ 6 trong vòng một giờ
- **THEN** hệ thống từ chối và báo thử lại sau

### Requirement: Đăng nhập bố mẹ
Hệ thống SHALL cho phép bố mẹ đăng nhập bằng email và mật khẩu, và đăng xuất. Khi đăng nhập sai, hệ thống MUST NOT tiết lộ là email hay mật khẩu bị sai. Sau 5 lần đăng nhập sai liên tiếp với cùng một email, hệ thống MUST tạm khóa đăng nhập bằng email đó trong 15 phút; mỗi địa chỉ IP MUST thử tối đa 20 lần trong 15 phút. Bộ đếm MUST áp dụng như nhau cho email có hoặc không có tài khoản, để không tiết lộ email nào đã đăng ký.

#### Scenario: Đăng nhập đúng
- **WHEN** bố mẹ nhập đúng email và mật khẩu
- **THEN** hệ thống đăng nhập và chuyển tới màn hình quản lý gia đình

#### Scenario: Đăng nhập sai
- **WHEN** bố mẹ nhập sai email hoặc sai mật khẩu
- **THEN** hệ thống từ chối với cùng một thông báo chung "Email hoặc mật khẩu không đúng"

#### Scenario: Đăng nhập sai quá nhiều lần
- **WHEN** có 5 lần đăng nhập sai liên tiếp với cùng một email, kể cả email chưa đăng ký
- **THEN** trong 15 phút tiếp theo mọi lần đăng nhập bằng email đó bị từ chối với thông báo "Đăng nhập sai nhiều lần, thử lại sau 15 phút", kể cả khi mật khẩu đúng

### Requirement: Đổi mật khẩu và hủy phiên
Bố mẹ đã đăng nhập SHALL đổi được mật khẩu khi nhập đúng mật khẩu hiện tại. Mật khẩu mới MUST tuân theo quy tắc độ dài như khi đăng ký. Khi đổi mật khẩu, mọi phiên khác của bố mẹ đó MUST bị hủy, còn phiên hiện tại được giữ. Khi người quản trị đặt lại mật khẩu bằng công cụ dòng lệnh, mọi phiên của bố mẹ đó MUST bị hủy.

#### Scenario: Đổi mật khẩu
- **WHEN** bố mẹ đang đăng nhập trên điện thoại và máy tính, rồi đổi mật khẩu trên máy tính với mật khẩu hiện tại đúng
- **THEN** mật khẩu được đổi, phiên trên máy tính vẫn dùng được, còn phiên trên điện thoại phải đăng nhập lại

#### Scenario: Sai mật khẩu hiện tại
- **WHEN** bố mẹ đổi mật khẩu nhưng nhập sai mật khẩu hiện tại
- **THEN** hệ thống từ chối và mật khẩu không đổi

#### Scenario: Đặt lại bằng công cụ quản trị
- **WHEN** người quản trị đặt lại mật khẩu của một bố mẹ bằng công cụ dòng lệnh
- **THEN** mọi phiên của bố mẹ đó bị hủy và họ phải đăng nhập bằng mật khẩu mới

### Requirement: Tạo gia đình
Bố mẹ chưa thuộc gia đình nào SHALL tạo được một gia đình và trở thành bố mẹ của gia đình đó. Mỗi tài khoản bố mẹ MUST thuộc tối đa một gia đình.

#### Scenario: Tạo gia đình lần đầu
- **WHEN** bố mẹ chưa có gia đình nhập tên gia đình và xác nhận
- **THEN** hệ thống tạo gia đình và gán người đó làm bố mẹ của gia đình

#### Scenario: Đã có gia đình
- **WHEN** bố mẹ đã thuộc một gia đình cố tạo gia đình mới
- **THEN** hệ thống từ chối

### Requirement: Mời bố mẹ khác
Bố mẹ SHALL tạo được liên kết mời dùng một lần, có hạn 7 ngày, để một tài khoản bố mẹ khác tham gia gia đình với quyền ngang bằng. Mỗi gia đình MUST tạo tối đa 10 lời mời trong một ngày.

#### Scenario: Chấp nhận lời mời hợp lệ
- **WHEN** một tài khoản bố mẹ chưa có gia đình mở liên kết mời còn hạn và chấp nhận
- **THEN** tài khoản đó trở thành bố mẹ của gia đình và liên kết hết hiệu lực

#### Scenario: Lời mời hết hạn hoặc đã dùng
- **WHEN** ai đó mở liên kết mời đã quá 7 ngày hoặc đã được dùng
- **THEN** hệ thống báo lời mời không còn hiệu lực

#### Scenario: Tạo quá nhiều lời mời
- **WHEN** một gia đình đã tạo 10 lời mời trong ngày và bố mẹ tạo thêm lời mời
- **THEN** hệ thống từ chối và báo thử lại vào ngày mai

### Requirement: Quản lý hồ sơ con
Bố mẹ SHALL tạo, sửa và lưu trữ hồ sơ con, gồm tên hiển thị, avatar chọn từ bộ có sẵn và PIN 4 chữ số. Hồ sơ đã lưu trữ MUST không còn hiện ở màn hình chọn avatar, nhưng lịch sử giao dịch vẫn được giữ.

#### Scenario: Tạo hồ sơ con
- **WHEN** bố mẹ nhập tên, chọn avatar và đặt PIN 4 chữ số
- **THEN** hồ sơ con được tạo với số dư 0 và hiện trên màn hình chọn avatar của gia đình

#### Scenario: PIN không hợp lệ
- **WHEN** bố mẹ đặt PIN không gồm đúng 4 chữ số
- **THEN** hệ thống từ chối và báo định dạng PIN

#### Scenario: Lưu trữ hồ sơ con
- **WHEN** bố mẹ lưu trữ một hồ sơ con
- **THEN** con đó không còn đăng nhập được, còn lịch sử giao dịch vẫn xem được từ phía bố mẹ

### Requirement: Đăng nhập con bằng avatar và PIN
Trên thiết bị đã được bố mẹ kích hoạt "chế độ gia đình", hệ thống SHALL hiển thị avatar của các con và cho con đăng nhập bằng PIN. Nhập sai 5 lần liên tiếp MUST khóa đăng nhập của con đó trong 5 phút.

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
Hệ thống MUST giới hạn mọi dữ liệu trong phạm vi gia đình của người dùng. Phiên của con MUST chỉ xem được dữ liệu của chính con đó và chỉ thực hiện được các thao tác của con (báo xong nhiệm vụ, khai rule thưởng, xin đổi thưởng, chọn mục tiêu, chọn theme, đọc thông báo).

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
