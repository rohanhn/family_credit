# family-accounts Specification

## Purpose

Quản lý gia đình như một không gian dữ liệu riêng, tài khoản bố mẹ, hồ sơ con và cách mỗi người đăng nhập, để mọi chức năng khác biết ai đang thao tác và với quyền gì.

## Requirements

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
Hệ thống SHALL cho phép bố mẹ đăng nhập bằng email và mật khẩu, và đăng xuất. Khi đăng nhập sai, hệ thống MUST NOT tiết lộ là email hay mật khẩu bị sai.

#### Scenario: Đăng nhập đúng
- **WHEN** bố mẹ nhập đúng email và mật khẩu
- **THEN** hệ thống đăng nhập và chuyển tới màn hình quản lý gia đình

#### Scenario: Đăng nhập sai
- **WHEN** bố mẹ nhập sai email hoặc sai mật khẩu
- **THEN** hệ thống từ chối với cùng một thông báo chung "Email hoặc mật khẩu không đúng"

### Requirement: Giới hạn đăng nhập sai
Sau 5 lần đăng nhập sai liên tiếp với cùng một email, hệ thống MUST tạm khóa đăng nhập bằng email đó trong 15 phút. Mỗi địa chỉ IP MUST thử đăng nhập tối đa 20 lần trong 15 phút. Bộ đếm MUST áp dụng như nhau cho email có hoặc không có tài khoản, để không tiết lộ email nào đã đăng ký.

#### Scenario: Đăng nhập sai quá nhiều lần
- **WHEN** có 5 lần đăng nhập sai liên tiếp với cùng một email, kể cả email chưa đăng ký
- **THEN** trong 15 phút tiếp theo mọi lần đăng nhập bằng email đó bị từ chối với thông báo "Đăng nhập sai nhiều lần, thử lại sau 15 phút", kể cả khi mật khẩu đúng

### Requirement: Thời hạn phiên bố mẹ
Khi bố mẹ đăng nhập trên thiết bị đang bật chế độ gia đình hoặc máy riêng của con, phiên bố mẹ MUST hết hạn sau 15 phút không thao tác và tự gia hạn khi còn thao tác. Trên thiết bị khác, phiên bố mẹ SHALL giữ 30 ngày và tự gia hạn khi dùng.

#### Scenario: Đăng nhập trên máy của con
- **WHEN** bố mẹ đăng nhập trên một thiết bị đang bật chế độ gia đình, duyệt xong rồi để máy lại không thao tác 15 phút
- **THEN** phiên bố mẹ trên thiết bị đó hết hạn; mở khu vực bố mẹ thì phải đăng nhập lại, còn màn chọn avatar của con vẫn dùng được

#### Scenario: Còn thao tác trên máy của con
- **WHEN** bố mẹ đăng nhập trên thiết bị đang bật chế độ gia đình và cứ vài phút lại thao tác một lần trong 40 phút
- **THEN** phiên bố mẹ vẫn còn hiệu lực trong suốt thời gian đó

#### Scenario: Đăng nhập trên máy của bố mẹ
- **WHEN** bố mẹ đăng nhập trên thiết bị không bật chế độ gia đình và không dùng 1 giờ
- **THEN** phiên bố mẹ vẫn còn hiệu lực (thời hạn 30 ngày, tự gia hạn khi dùng)

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
Hệ thống MUST giới hạn mọi dữ liệu trong phạm vi gia đình của người dùng. Phiên của con MUST chỉ xem được dữ liệu của chính con đó và chỉ thực hiện được các thao tác của con (báo xong nhiệm vụ, khai rule thưởng, đề xuất thưởng/phạt ngoài rule, xin đổi thưởng, chọn mục tiêu, chọn theme, đọc thông báo, đổi PIN của chính mình).

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

#### Scenario: Con cố tự duyệt đề xuất của mình
- **WHEN** phiên của con gửi yêu cầu duyệt hoặc từ chối một đề xuất ngoài rule
- **THEN** hệ thống từ chối và đề xuất vẫn "chờ duyệt"

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
