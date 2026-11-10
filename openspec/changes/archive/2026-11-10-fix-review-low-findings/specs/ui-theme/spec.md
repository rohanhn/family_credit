## MODIFIED Requirements

### Requirement: Thứ tự hiển thị phản hồi điểm
Khi con có cả giao dịch cộng điểm và trừ điểm mới, màn ăn mừng SHALL hiện trước, màn báo trừ điểm hiện sau. Thông báo mới đến trong lúc con đang xem một màn phản hồi MUST NOT thay màn đó giữa chừng; thông báo mới được hiển thị sau khi con đóng màn hiện tại, và âm thanh của mỗi màn chỉ phát một lần.

#### Scenario: Vừa được cộng vừa bị trừ
- **WHEN** từ lần xem trước con có một giao dịch +15 và một giao dịch −10
- **THEN** thông báo "+15" hiện trước, sau đó là thông báo "−10"

#### Scenario: Có quà mới khi đang xem màn bị trừ
- **WHEN** con đang xem màn báo bị trừ điểm và bố mẹ vừa duyệt một nhiệm vụ của con
- **THEN** màn bị trừ vẫn hiển thị cho tới khi con bấm "Con hiểu rồi", sau đó màn ăn mừng hiện, và âm phạt không phát lại
