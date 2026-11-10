## ADDED Requirements

### Requirement: Cài ứng dụng lên màn hình chính
Ứng dụng SHALL cung cấp thông tin để trình duyệt di động cho phép "Thêm vào màn hình chính": tên ứng dụng, icon và màu theme. Mở từ màn hình chính SHALL vào trang gốc của ứng dụng và hiển thị ở chế độ toàn màn hình, không có thanh địa chỉ.

#### Scenario: Thêm vào màn hình chính
- **WHEN** con dùng trình duyệt trên điện thoại chọn "Thêm vào màn hình chính"
- **THEN** màn hình chính có icon của ứng dụng với tên ứng dụng

#### Scenario: Mở từ màn hình chính
- **WHEN** con mở ứng dụng từ icon trên màn hình chính
- **THEN** ứng dụng mở ở chế độ toàn màn hình tại trang gốc và đưa con tới đúng nơi theo trạng thái thiết bị
