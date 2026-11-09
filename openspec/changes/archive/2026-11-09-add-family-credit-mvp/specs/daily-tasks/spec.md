# Spec Delta

## Purpose

Cho phép bố mẹ giao nhiệm vụ lặp lại hằng ngày, riêng cho từng con hoặc chung cho nhiều con, để con báo hoàn thành và bố mẹ duyệt rồi trả thưởng vào cuối ngày.

## ADDED Requirements

### Requirement: Giao nhiệm vụ hằng ngày
Bố mẹ SHALL tạo, sửa và tạm dừng nhiệm vụ hằng ngày. Mỗi nhiệm vụ gồm tên, số điểm thưởng là số nguyên dương, các ngày trong tuần áp dụng (mặc định cả 7 ngày), kiểu (mỗi con làm riêng hoặc cả nhóm làm chung) và danh sách con được giao. Thay đổi MUST chỉ có hiệu lực từ ngày hôm sau.

#### Scenario: Giao riêng cho một con
- **WHEN** bố mẹ tạo nhiệm vụ "Làm bài tập" 15 điểm, kiểu mỗi con làm riêng, giao cho một con, áp dụng thứ Hai đến thứ Sáu
- **THEN** nhiệm vụ chỉ xuất hiện trong danh sách của con đó vào mỗi ngày từ thứ Hai đến thứ Sáu

#### Scenario: Ngày không áp dụng
- **WHEN** hôm nay là Chủ nhật và nhiệm vụ chỉ áp dụng thứ Hai đến thứ Sáu
- **THEN** nhiệm vụ không xuất hiện trong danh sách hôm nay

#### Scenario: Tạm dừng nhiệm vụ
- **WHEN** bố mẹ tạm dừng một nhiệm vụ
- **THEN** từ ngày hôm sau nhiệm vụ không còn xuất hiện với mọi con được giao, và các ngày trước đó vẫn giữ trạng thái cũ

#### Scenario: Sửa nhiệm vụ đã giao cho nhiều con
- **WHEN** bố mẹ đổi điểm của một nhiệm vụ đang giao cho ba con từ 5 lên 8
- **THEN** từ ngày hôm sau cả ba con đều thấy nhiệm vụ 8 điểm

### Requirement: Chọn con được giao nhiệm vụ
Khi tạo hoặc sửa nhiệm vụ, bố mẹ SHALL chọn từng con được giao hoặc chọn "Tất cả các con". Nhiệm vụ MUST có ít nhất một con được giao. Với "Tất cả các con", con được thêm vào gia đình sau này SHALL tự động được giao. Con đã lưu trữ MUST không còn được giao nhiệm vụ nào.

#### Scenario: Chọn nhiều con
- **WHEN** bố mẹ giao nhiệm vụ cho hai trong ba con
- **THEN** chỉ hai con đó thấy nhiệm vụ

#### Scenario: Không chọn con nào
- **WHEN** bố mẹ lưu một nhiệm vụ mà không chọn con nào và không chọn "Tất cả các con"
- **THEN** hệ thống từ chối và yêu cầu chọn ít nhất một con

#### Scenario: "Tất cả các con" gồm cả con mới
- **WHEN** một nhiệm vụ được giao cho "Tất cả các con" và bố mẹ tạo thêm hồ sơ con mới
- **THEN** từ ngày hôm sau con mới thấy nhiệm vụ đó

#### Scenario: Con đã lưu trữ
- **WHEN** bố mẹ lưu trữ một con đang được giao nhiệm vụ
- **THEN** nhiệm vụ không còn xuất hiện với con đó, và trạng thái những ngày trước vẫn được giữ

### Requirement: Nhiệm vụ mỗi con làm riêng
Với nhiệm vụ kiểu mỗi con làm riêng, mỗi con được giao SHALL có trạng thái và điểm thưởng riêng cho từng ngày, độc lập với các con khác.

#### Scenario: Hai con làm cùng một nhiệm vụ
- **WHEN** nhiệm vụ "Đánh răng tối" 5 điểm giao cho hai con, bố mẹ duyệt cho con A còn con B chưa báo xong
- **THEN** con A được cộng 5 điểm và nhiệm vụ của con A là "hoàn thành", còn nhiệm vụ của con B vẫn là "chưa làm"

### Requirement: Nhiệm vụ cả nhóm làm chung
Với nhiệm vụ kiểu cả nhóm làm chung, các con được giao SHALL có một trạng thái chung cho mỗi ngày. Khi duyệt, bố mẹ SHALL chọn những con đã tham gia (mặc định chọn tất cả), và mỗi con được chọn MUST nhận một giao dịch bằng đủ số điểm của nhiệm vụ.

#### Scenario: Duyệt nhiệm vụ nhóm
- **WHEN** bố mẹ duyệt nhiệm vụ nhóm "Dọn phòng chơi" 20 điểm giao cho ba con và giữ chọn cả ba
- **THEN** nhiệm vụ nhóm chuyển sang "hoàn thành" và mỗi con có một giao dịch +20 loại "nhiệm vụ"

#### Scenario: Một con không tham gia
- **WHEN** bố mẹ duyệt nhiệm vụ nhóm và bỏ chọn một con không tham gia
- **THEN** chỉ những con còn được chọn được cộng điểm, và nhiệm vụ nhóm vẫn là "hoàn thành" với tất cả

#### Scenario: Không chọn con nào khi duyệt
- **WHEN** bố mẹ duyệt nhiệm vụ nhóm nhưng bỏ chọn tất cả các con
- **THEN** hệ thống từ chối thao tác duyệt và gợi ý dùng "Từ chối"

### Requirement: Ngày tính theo múi giờ gia đình
Mỗi gia đình SHALL có một múi giờ (mặc định Asia/Ho_Chi_Minh). Ranh giới "ngày" của nhiệm vụ MUST được tính theo múi giờ này.

#### Scenario: Qua nửa đêm
- **WHEN** đồng hồ theo múi giờ gia đình chuyển sang 00:00
- **THEN** danh sách nhiệm vụ của con chuyển sang ngày mới

### Requirement: Con báo hoàn thành
Con SHALL báo hoàn thành một nhiệm vụ của ngày hôm nay được giao cho mình, chuyển nhiệm vụ sang "chờ duyệt". Con SHALL hủy báo được khi bố mẹ chưa duyệt. Với nhiệm vụ nhóm, bất kỳ con nào trong nhóm cũng báo hoặc hủy báo được cho cả nhóm. Báo hoàn thành MUST NOT cộng điểm.

#### Scenario: Báo hoàn thành
- **WHEN** con bấm "Con xong rồi" trên một nhiệm vụ riêng hôm nay
- **THEN** nhiệm vụ của con chuyển sang "chờ duyệt" và số dư chưa thay đổi

#### Scenario: Hủy báo
- **WHEN** con hủy báo trên một nhiệm vụ đang "chờ duyệt"
- **THEN** nhiệm vụ trở lại "chưa làm"

#### Scenario: Báo xong nhiệm vụ nhóm
- **WHEN** một con trong nhóm bấm "Xong rồi" trên nhiệm vụ nhóm
- **THEN** nhiệm vụ nhóm chuyển sang "chờ duyệt" với mọi con trong nhóm, kèm tên con đã báo

### Requirement: Bố mẹ duyệt nhiệm vụ
Bố mẹ SHALL thấy danh sách nhiệm vụ chờ duyệt của cả gia đình, cả riêng lẫn nhóm, và duyệt hoặc từ chối từng mục (từ chối có thể kèm lý do). Bố mẹ SHALL tự đánh dấu hoàn thành một nhiệm vụ chưa được báo. Mỗi con MUST được cộng điểm tối đa một lần cho mỗi nhiệm vụ mỗi ngày.

#### Scenario: Duyệt nhiệm vụ riêng
- **WHEN** bố mẹ duyệt nhiệm vụ riêng "Làm bài tập" 15 điểm đang chờ duyệt
- **THEN** nhiệm vụ chuyển sang "hoàn thành" và sổ cái của con có thêm giao dịch +15 loại "nhiệm vụ"

#### Scenario: Từ chối nhiệm vụ
- **WHEN** bố mẹ từ chối một nhiệm vụ đang chờ duyệt với lý do "Chưa làm xong bài toán"
- **THEN** nhiệm vụ trở lại "chưa làm" (với nhiệm vụ nhóm là với cả nhóm), các con liên quan thấy lý do, và không có giao dịch nào được ghi

#### Scenario: Bố mẹ tự đánh dấu
- **WHEN** bố mẹ đánh dấu hoàn thành một nhiệm vụ con chưa báo
- **THEN** nhiệm vụ chuyển sang "hoàn thành" và điểm được cộng (với nhiệm vụ nhóm, cho những con bố mẹ chọn)

#### Scenario: Không cộng hai lần
- **WHEN** một nhiệm vụ trong ngày đã "hoàn thành" và có thao tác duyệt lần nữa
- **THEN** hệ thống từ chối và không ghi thêm giao dịch

### Requirement: Duyệt nhiệm vụ của ngày trước
Bố mẹ SHALL duyệt hoặc đánh dấu hoàn thành nhiệm vụ của tối đa 7 ngày trước đó, để phục vụ việc kiểm tra muộn. Con MUST chỉ báo hoàn thành nhiệm vụ của ngày hôm nay.

#### Scenario: Duyệt muộn
- **WHEN** sáng nay bố mẹ duyệt một nhiệm vụ con đã báo từ hôm qua
- **THEN** điểm được cộng, giao dịch ghi rõ ngày của nhiệm vụ

#### Scenario: Con báo ngày cũ
- **WHEN** con cố báo hoàn thành một nhiệm vụ của hôm qua
- **THEN** hệ thống từ chối

### Requirement: Con xem nhiệm vụ hôm nay
Con SHALL thấy danh sách nhiệm vụ hôm nay được giao cho mình, kèm điểm thưởng và trạng thái (chưa làm, chờ duyệt, hoàn thành). Nhiệm vụ nhóm MUST có nhãn "Nhiệm vụ nhóm", kèm tên các con cùng nhóm và tên con đã báo xong (nếu có).

#### Scenario: Xem tiến độ trong ngày
- **WHEN** con mở màn hình riêng
- **THEN** con thấy các nhiệm vụ hôm nay kèm trạng thái và số điểm từng nhiệm vụ

#### Scenario: Xem nhiệm vụ nhóm
- **WHEN** con được giao một nhiệm vụ nhóm mà anh của con đã báo xong
- **THEN** nhiệm vụ hiển thị nhãn "Nhiệm vụ nhóm", các thành viên trong nhóm, trạng thái "chờ duyệt" và tên người anh đã báo
