# Spec Delta

## ADDED Requirements

### Requirement: Thời gian nghe rõ của âm thanh phản hồi
Mỗi âm thanh phản hồi MUST có thời gian nghe rõ đủ dài để nhận ra trên loa điện thoại: âm thưởng và âm phạt tối thiểu 600 ms, âm đổi quà tối thiểu 300 ms, âm khi con báo xong nhiệm vụ hoặc bật lại loa tối thiểu 200 ms. Thời gian nghe rõ là tổng thời gian biên độ của âm đạt từ −30 dBFS trở lên. Toàn bộ một âm MUST NOT dài quá 1,5 giây.

#### Scenario: Âm thưởng đủ dài
- **WHEN** con mở màn hình riêng, có giao dịch cộng điểm mới và âm thanh đang bật
- **THEN** âm thưởng phát với thời gian nghe rõ ít nhất 600 ms và kết thúc trong vòng 1,5 giây

#### Scenario: Âm phạt đủ dài
- **WHEN** con thấy thông báo bị trừ điểm và âm thanh đang bật
- **THEN** âm phạt phát với thời gian nghe rõ ít nhất 600 ms, vẫn nhẹ và trầm như trước

#### Scenario: Âm báo xong nhiệm vụ đủ dài
- **WHEN** con bấm "Con xong rồi" và âm thanh đang bật
- **THEN** âm phát với thời gian nghe rõ ít nhất 200 ms

#### Scenario: Âm khi bật lại loa đủ dài
- **WHEN** người dùng bấm nút loa để bật lại âm thanh
- **THEN** âm nghe thử phát với thời gian nghe rõ ít nhất 200 ms

#### Scenario: Âm đổi quà đủ dài
- **WHEN** con thấy thông báo yêu cầu đổi thưởng được duyệt và âm thanh đang bật
- **THEN** âm đổi quà phát với thời gian nghe rõ ít nhất 300 ms

### Requirement: Âm đổi quà phát sau âm thưởng
Khi một màn ăn mừng vừa có điểm được cộng vừa có yêu cầu đổi thưởng được duyệt, hệ thống SHALL phát âm thưởng trước và chỉ bắt đầu âm đổi quà sau khi âm thưởng đã kết thúc.

#### Scenario: Màn ăn mừng có cả điểm cộng và quà được duyệt
- **WHEN** con mở màn ăn mừng gồm một khoản cộng điểm và một yêu cầu đổi thưởng được duyệt, âm thanh đang bật
- **THEN** âm thưởng phát trọn vẹn, sau đó âm đổi quà mới bắt đầu, hai âm không chồng lên nhau

#### Scenario: Màn ăn mừng chỉ có quà được duyệt
- **WHEN** con mở màn ăn mừng chỉ có yêu cầu đổi thưởng được duyệt, không có điểm cộng
- **THEN** âm đổi quà phát ngay, không có khoảng chờ
