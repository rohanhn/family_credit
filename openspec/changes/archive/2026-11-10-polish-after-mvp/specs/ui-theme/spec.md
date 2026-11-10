## MODIFIED Requirements

### Requirement: Giao diện responsive
Mọi màn hình SHALL dùng được ở chiều rộng từ 360px tới màn hình máy tính, không có thanh cuộn ngang. Danh sách dạng bảng của bố mẹ SHALL chuyển sang dạng thẻ ở màn hình hẹp, để mọi cột và nút thao tác đều thấy được mà không cần cuộn ngang trong bảng. Các vùng bấm trên màn hình của con MUST có kích thước tối thiểu 44x44px.

#### Scenario: Màn hình điện thoại
- **WHEN** ứng dụng được mở ở chiều rộng 360px
- **THEN** mọi nội dung và nút bấm hiển thị đầy đủ, không có thanh cuộn ngang

#### Scenario: Màn hình máy tính
- **WHEN** ứng dụng được mở ở chiều rộng 1280px
- **THEN** bố cục tận dụng chiều rộng mà không kéo giãn nội dung tới mức khó đọc

#### Scenario: Danh sách nhiệm vụ trên điện thoại
- **WHEN** bố mẹ mở trang nhiệm vụ ở chiều rộng 360px
- **THEN** mỗi nhiệm vụ hiện thành một thẻ có tên, điểm, ngày áp dụng, người được giao, cách làm, trạng thái và hai nút "Sửa", "Tạm dừng", không phải cuộn ngang

#### Scenario: Danh sách nhiệm vụ trên máy tính
- **WHEN** bố mẹ mở trang nhiệm vụ ở chiều rộng 1280px
- **THEN** danh sách hiện dạng bảng, cột thao tác căn thẳng hàng giữa các dòng
