# Spec Delta

## Purpose

Cho phép gia đình định nghĩa trước các hành động được thưởng hoặc bị phạt kèm số điểm, áp dụng nhanh cho từng con, và vẫn thưởng/phạt được những tình huống đột xuất ngoài danh sách.

## ADDED Requirements

### Requirement: Quản lý danh mục rule
Bố mẹ SHALL tạo, sửa, ẩn và hiện lại các rule. Mỗi rule gồm tên, loại (thưởng hoặc phạt), số điểm là số nguyên dương, và icon tùy chọn. Rule bị ẩn MUST không hiện khi áp dụng nhưng vẫn được giữ lại.

#### Scenario: Tạo rule thưởng
- **WHEN** bố mẹ tạo rule "Đánh răng tối", loại thưởng, 5 điểm
- **THEN** rule xuất hiện trong danh mục rule thưởng của gia đình

#### Scenario: Số điểm không hợp lệ
- **WHEN** bố mẹ tạo rule với số điểm 0, số âm hoặc không phải số nguyên
- **THEN** hệ thống từ chối và báo số điểm phải là số nguyên dương

#### Scenario: Ẩn rule
- **WHEN** bố mẹ ẩn một rule
- **THEN** rule không còn hiện trong danh sách áp dụng, và có thể hiện lại sau

### Requirement: Sửa rule không ảnh hưởng giao dịch cũ
Việc sửa tên hoặc số điểm của rule MUST chỉ áp dụng cho các lần áp dụng sau đó. Giao dịch đã ghi giữ nguyên tên và số điểm tại thời điểm áp dụng.

#### Scenario: Đổi điểm rule
- **WHEN** rule "Đánh răng tối" đổi từ 5 lên 8 điểm sau khi đã được áp dụng một lần
- **THEN** giao dịch cũ vẫn ghi +5 "Đánh răng tối", và lần áp dụng tiếp theo ghi +8

### Requirement: Áp dụng rule cho con
Bố mẹ SHALL áp dụng một rule đang hiện cho một con, kèm ghi chú tùy chọn. Hệ thống SHALL ghi một giao dịch loại "rule" vào sổ cái, tuân theo quy tắc số dư không âm.

#### Scenario: Áp dụng rule thưởng
- **WHEN** bố mẹ áp dụng rule thưởng 5 điểm cho con
- **THEN** sổ cái của con có thêm giao dịch +5 mang tên rule

#### Scenario: Áp dụng rule phạt
- **WHEN** bố mẹ áp dụng rule phạt 10 điểm cho con đang có 30 điểm
- **THEN** sổ cái có thêm giao dịch -10 và số dư còn 20

### Requirement: Thưởng/phạt đột xuất
Bố mẹ SHALL thưởng hoặc phạt một con với số điểm nguyên dương và lý do bắt buộc mà không cần rule có sẵn. Hệ thống SHALL ghi giao dịch loại "đột xuất".

#### Scenario: Thưởng đột xuất
- **WHEN** bố mẹ thưởng 20 điểm cho con với lý do "Giúp bà dọn nhà"
- **THEN** sổ cái có thêm giao dịch +20 loại "đột xuất" với lý do đó

#### Scenario: Thiếu lý do
- **WHEN** bố mẹ thưởng hoặc phạt đột xuất mà không nhập lý do
- **THEN** hệ thống từ chối và yêu cầu nhập lý do

### Requirement: Con xem danh sách rule
Con SHALL xem được các rule đang hiện của gia đình kèm số điểm, để biết hành động nào được thưởng hoặc bị phạt. Con MUST NOT tạo, sửa hoặc áp dụng rule.

#### Scenario: Con mở danh sách rule
- **WHEN** con mở màn hình rule
- **THEN** con thấy các rule thưởng và phạt đang hiện, kèm số điểm, và không có nút sửa hay áp dụng
