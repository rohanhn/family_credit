# Spec Delta

## MODIFIED Requirements

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
