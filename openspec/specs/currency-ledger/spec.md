# currency-ledger Specification

## Purpose

Định nghĩa đơn vị tiền tệ riêng của mỗi gia đình và sổ cái ghi lại mọi biến động điểm của từng con, làm nguồn sự thật duy nhất cho số dư và lịch sử thưởng/phạt.

## Requirements

### Requirement: Đơn vị tiền tệ của gia đình
Mỗi gia đình SHALL có đúng một đơn vị tiền tệ gồm tên (1–20 ký tự) và icon chọn từ bộ có sẵn. Khi tạo gia đình, đơn vị mặc định là "Sao". Bố mẹ SHALL đổi được tên và icon bất cứ lúc nào.

#### Scenario: Đơn vị mặc định
- **WHEN** một gia đình mới được tạo
- **THEN** đơn vị tiền tệ của gia đình là "Sao" với icon ngôi sao

#### Scenario: Đổi tên đơn vị
- **WHEN** bố mẹ đổi tên đơn vị thành "Phút game"
- **THEN** mọi màn hình, kể cả lịch sử cũ, hiển thị số điểm với tên "Phút game" và số điểm không thay đổi

### Requirement: Sổ cái chỉ ghi thêm
Mọi thay đổi điểm của một con SHALL được ghi thành một giao dịch gồm: con, số điểm (dương là cộng, âm là trừ), loại (rule, nhiệm vụ, đột xuất, đổi thưởng, điều chỉnh), mô tả, bố mẹ thực hiện và thời điểm. Giao dịch đã ghi MUST NOT bị sửa hoặc xóa.

#### Scenario: Ghi giao dịch
- **WHEN** bố mẹ thưởng 10 điểm cho con
- **THEN** sổ cái có thêm một giao dịch +10 kèm loại, mô tả, người thực hiện và thời điểm

#### Scenario: Không sửa giao dịch đã ghi
- **WHEN** có yêu cầu sửa hoặc xóa một giao dịch đã ghi
- **THEN** hệ thống từ chối

### Requirement: Giao dịch điều chỉnh
Bố mẹ SHALL ghi được giao dịch điều chỉnh tham chiếu tới một giao dịch trước đó kèm lý do, để sửa sai mà không làm mất lịch sử.

#### Scenario: Hoàn tác một lần thưởng nhầm
- **WHEN** bố mẹ điều chỉnh giao dịch +10 bị ghi nhầm, với lý do "bấm nhầm"
- **THEN** sổ cái có thêm giao dịch điều chỉnh tham chiếu giao dịch gốc, và số dư giảm tương ứng

### Requirement: Số dư tính từ sổ cái
Số dư của một con SHALL luôn bằng tổng các giao dịch của con đó.

#### Scenario: Số dư sau nhiều giao dịch
- **WHEN** con có các giao dịch +10, +5, -3
- **THEN** số dư của con là 12

### Requirement: Số dư không âm
Số dư của con MUST NOT nhỏ hơn 0. Khi một khoản trừ lớn hơn số dư hiện có, hệ thống SHALL chỉ trừ bằng số dư hiện có, và giao dịch MUST lưu cả mức trừ gốc lẫn mức thực trừ.

#### Scenario: Phạt vượt số dư
- **WHEN** con có 5 điểm và bị phạt 20 điểm
- **THEN** giao dịch ghi thực trừ -5, mức gốc -20, và số dư về 0

#### Scenario: Phạt khi số dư bằng 0
- **WHEN** con có 0 điểm và bị phạt 10 điểm
- **THEN** giao dịch được ghi với thực trừ 0 và mức gốc -10, để lịch sử vẫn có lần phạt

### Requirement: Xem lịch sử giao dịch
Bố mẹ SHALL xem được lịch sử giao dịch của từng con hoặc của cả gia đình. Con SHALL xem được lịch sử của chính mình. Lịch sử sắp xếp mới nhất trước và lọc được theo khoảng ngày và loại giao dịch.

#### Scenario: Bố mẹ xem lịch sử một con
- **WHEN** bố mẹ mở lịch sử của một con
- **THEN** hệ thống hiển thị các giao dịch của con đó, mới nhất trước, mỗi dòng có điểm, loại, mô tả, người thực hiện và thời điểm

#### Scenario: Lọc theo loại
- **WHEN** bố mẹ lọc lịch sử theo loại "đổi thưởng"
- **THEN** chỉ các giao dịch đổi thưởng được hiển thị

#### Scenario: Con xem lịch sử của mình
- **WHEN** con mở màn hình lịch sử
- **THEN** con thấy các giao dịch của chính mình và không thấy của anh chị em
