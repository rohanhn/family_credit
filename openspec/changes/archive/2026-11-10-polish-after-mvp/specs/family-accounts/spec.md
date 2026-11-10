## MODIFIED Requirements

### Requirement: Đăng nhập bố mẹ
Hệ thống SHALL cho phép bố mẹ đăng nhập bằng email và mật khẩu, và đăng xuất. Khi đăng nhập sai, hệ thống MUST NOT tiết lộ là email hay mật khẩu bị sai. Sau 5 lần đăng nhập sai liên tiếp với cùng một email, hệ thống MUST tạm khóa đăng nhập bằng email đó trong 15 phút; mỗi địa chỉ IP MUST thử tối đa 20 lần trong 15 phút. Bộ đếm MUST áp dụng như nhau cho email có hoặc không có tài khoản, để không tiết lộ email nào đã đăng ký. Khi đăng nhập trên thiết bị đang bật chế độ gia đình hoặc máy riêng của con, phiên bố mẹ MUST hết hạn sau 15 phút không thao tác (còn thao tác thì tự gia hạn); trên thiết bị khác, phiên bố mẹ giữ 30 ngày và tự gia hạn.

#### Scenario: Đăng nhập đúng
- **WHEN** bố mẹ nhập đúng email và mật khẩu
- **THEN** hệ thống đăng nhập và chuyển tới màn hình quản lý gia đình

#### Scenario: Đăng nhập sai
- **WHEN** bố mẹ nhập sai email hoặc sai mật khẩu
- **THEN** hệ thống từ chối với cùng một thông báo chung "Email hoặc mật khẩu không đúng"

#### Scenario: Đăng nhập sai quá nhiều lần
- **WHEN** có 5 lần đăng nhập sai liên tiếp với cùng một email, kể cả email chưa đăng ký
- **THEN** trong 15 phút tiếp theo mọi lần đăng nhập bằng email đó bị từ chối với thông báo "Đăng nhập sai nhiều lần, thử lại sau 15 phút", kể cả khi mật khẩu đúng

#### Scenario: Đăng nhập trên máy của con
- **WHEN** bố mẹ đăng nhập trên một thiết bị đang bật chế độ gia đình, duyệt xong rồi để máy lại không thao tác 15 phút
- **THEN** phiên bố mẹ trên thiết bị đó hết hạn; mở khu vực bố mẹ thì phải đăng nhập lại, còn màn chọn avatar của con vẫn dùng được

#### Scenario: Còn thao tác trên máy của con
- **WHEN** bố mẹ đăng nhập trên thiết bị đang bật chế độ gia đình và cứ vài phút lại thao tác một lần trong 40 phút
- **THEN** phiên bố mẹ vẫn còn hiệu lực trong suốt thời gian đó

#### Scenario: Đăng nhập trên máy của bố mẹ
- **WHEN** bố mẹ đăng nhập trên thiết bị không bật chế độ gia đình và không dùng 1 giờ
- **THEN** phiên bố mẹ vẫn còn hiệu lực (thời hạn 30 ngày, tự gia hạn khi dùng)
