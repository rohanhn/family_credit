## MODIFIED Requirements

### Requirement: Xem lịch sử giao dịch
Bố mẹ SHALL xem được lịch sử giao dịch của từng con hoặc của cả gia đình. Con SHALL xem được lịch sử của chính mình. Lịch sử sắp xếp mới nhất trước và lọc được theo khoảng ngày và loại giao dịch, ở cả phía bố mẹ lẫn phía con. Lịch sử dài SHALL được chia trang; hệ thống MUST NOT cắt bớt giao dịch cũ mà không cho người xem cách xem tiếp.

#### Scenario: Bố mẹ xem lịch sử một con
- **WHEN** bố mẹ mở lịch sử của một con
- **THEN** hệ thống hiển thị các giao dịch của con đó, mới nhất trước, mỗi dòng có điểm, loại, mô tả, người thực hiện và thời điểm

#### Scenario: Lọc theo loại
- **WHEN** bố mẹ lọc lịch sử theo loại "đổi thưởng"
- **THEN** chỉ các giao dịch đổi thưởng được hiển thị

#### Scenario: Con xem lịch sử của mình
- **WHEN** con mở màn hình lịch sử
- **THEN** con thấy các giao dịch của chính mình và không thấy của anh chị em

#### Scenario: Lịch sử dài hơn một trang
- **WHEN** lịch sử theo bộ lọc hiện tại có nhiều giao dịch hơn một trang
- **THEN** cuối danh sách có nút "Xem thêm"; bấm vào thì hiện tiếp các giao dịch cũ hơn, giữ nguyên bộ lọc, cho tới khi hết

#### Scenario: Con lọc lịch sử của mình
- **WHEN** con lọc lịch sử theo loại "đổi thưởng" và khoảng ngày từ 01/11 tới 07/11
- **THEN** chỉ các giao dịch đổi thưởng của chính con trong khoảng ngày đó (theo múi giờ gia đình) được hiển thị, và bấm "Xem thêm" vẫn giữ nguyên bộ lọc
