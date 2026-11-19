# Spec Delta

## ADDED Requirements

### Requirement: Khoản trừ luôn ghi đủ
Mỗi giao dịch trừ điểm ghi sau thay đổi này SHALL trừ đúng mức gốc, kể cả khi mức gốc lớn hơn số dư hiện có, nên số dư của con có thể nhỏ hơn 0. Hệ thống MUST NOT đặt mức sàn cho số dư. Riêng giao dịch đổi thưởng chỉ được ghi khi đủ điều kiện duyệt trong capability `reward-shop`, nên không bao giờ làm số dư nhỏ hơn 0. Giao dịch đã ghi trước thay đổi này giữ nguyên mức thực trừ đã lưu.

#### Scenario: Phạt vượt số dư
- **WHEN** con có 5 điểm và bị phạt 20 điểm
- **THEN** giao dịch ghi −20 và số dư là −15

#### Scenario: Phạt khi số dư bằng 0
- **WHEN** con có 0 điểm và bị phạt 10 điểm
- **THEN** giao dịch ghi −10 và số dư là −10

#### Scenario: Phạt khi đang nợ
- **WHEN** con có số dư −10 và bị phạt thêm 5 điểm
- **THEN** giao dịch ghi −5 và số dư là −15

#### Scenario: Thứ tự thưởng và phạt không đổi kết quả
- **WHEN** con có 5 điểm, nhận một lần thưởng +20 và một lần phạt −20 theo bất kỳ thứ tự nào
- **THEN** số dư cuối cùng là 5

#### Scenario: Giao dịch cũ đã bị chặn
- **WHEN** lịch sử có một lần phạt ghi trước thay đổi này với mức gốc −20 và mức thực trừ −5
- **THEN** giao dịch đó giữ nguyên mức thực trừ −5, lịch sử vẫn hiện cả mức gốc, và số dư không bị tính lại

## MODIFIED Requirements

### Requirement: Giao dịch điều chỉnh
Bố mẹ SHALL ghi được giao dịch điều chỉnh tham chiếu tới một giao dịch trước đó kèm lý do, để sửa sai mà không làm mất lịch sử. Giao dịch điều chỉnh SHALL đảo ngược đủ mức thực ghi của giao dịch gốc, kể cả khi việc đó làm số dư nhỏ hơn 0.

#### Scenario: Hoàn tác một lần thưởng nhầm
- **WHEN** bố mẹ điều chỉnh giao dịch +10 bị ghi nhầm, với lý do "bấm nhầm"
- **THEN** sổ cái có thêm giao dịch điều chỉnh tham chiếu giao dịch gốc, và số dư giảm tương ứng

#### Scenario: Hoàn tác thưởng nhầm sau khi con đã tiêu hết
- **WHEN** con được thưởng nhầm +10, đổi quà hết còn 0 điểm, rồi bố mẹ điều chỉnh giao dịch +10 đó
- **THEN** giao dịch điều chỉnh ghi −10 và số dư là −10

## REMOVED Requirements

### Requirement: Số dư không âm
**Reason**: Chặn số dư ở 0 làm khoản phạt mất tác dụng khi con hết điểm, làm kết quả phụ thuộc thứ tự thưởng/phạt, và khiến hoàn tác thưởng nhầm không thu lại được.
**Migration**: Thay bằng requirement "Khoản trừ luôn ghi đủ" trong capability này và trạng thái nợ trong capability `debt-freeze`. Giao dịch đã ghi giữ nguyên; không cần chuyển dữ liệu.
