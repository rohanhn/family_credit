# Design

## Context

Xem proposal.md mục Why. Luồng "con khai rule thưởng, bố mẹ duyệt" đã có và là khuôn mẫu cho change này:

- `src/server/domain/rule-claims.ts`: tạo, hủy, liệt kê, duyệt, từ chối. Duyệt và từ chối khóa dòng yêu cầu rồi cập nhật có điều kiện `status = 'pending'`, nên mỗi yêu cầu chỉ được xử lý một lần.
- `recordTransaction` trong `src/server/domain/ledger.ts` khóa dòng của con, áp quy tắc số dư không âm và tạo thông báo cho con trong cùng transaction.
- Bảng `rule_claims` bắt buộc có `rule_id` và chụp tên, điểm của rule.
- `src/app/parent/approval-queue.tsx` gộp ba nguồn chờ duyệt; `DecisionForm` đã có chỗ (`extra`) để gửi thêm trường khi duyệt.
- Thưởng/phạt đột xuất của bố mẹ (`applyAdhoc`) ghi giao dịch loại `adhoc` với lý do tối đa 200 ký tự và số điểm từ 1 đến 100 000.

## Goals / Non-Goals

**Goals:**
- Đáp ứng ba spec delta: `reward-rules`, `kid-notifications`, `family-accounts`.
- Dùng lại sổ cái, thông báo và hàng chờ duyệt hiện có; không thêm loại giao dịch hay loại thông báo mới.

**Non-Goals:**
- Con tự nhận phạt theo rule phạt có sẵn; rule phạt vẫn chỉ để xem.
- Con đề xuất thêm rule mới vào danh sách rule của gia đình.
- Báo riêng cho con biết bố mẹ đã sửa số điểm so với đề xuất; con chỉ thấy số điểm thực nhận hoặc bị trừ.
- Con xem lại lịch sử các đề xuất đã xử lý; con chỉ thấy đề xuất đang chờ, kết quả đến qua thông báo và lịch sử giao dịch.
- Phát âm thanh phía bố mẹ khi duyệt (các nút duyệt hiện có cũng không phát).

## Decisions

### D1. Bảng mới `adhoc_proposals`, không mở rộng `rule_claims`

Cột: `id`, `child_id`, `kind` (`reward` | `penalty`, dùng lại `RULE_KINDS`), `description`, `proposed_points`, `approved_points` (null cho tới khi duyệt), `status` (dùng lại `REQUEST_STATUSES`), `reason`, `decided_by_parent_id`, `created_at`, `decided_at`. Ràng buộc: `proposed_points > 0`, `approved_points` null hoặc `> 0`, CHECK cho `kind` và `status`; index `(child_id, status)`.

Lý do: `rule_claims.rule_id` là NOT NULL và bảng không có chỗ cho loại phạt hay số điểm được duyệt. Nới bảng cũ sẽ khiến mọi truy vấn khai rule phải phân biệt hai loại dòng.

Đã cân nhắc thêm cột vào `rule_claims` với `rule_id` nullable: ít bảng hơn nhưng làm yếu ràng buộc của luồng đang chạy ổn.

### D2. Module domain mới theo khuôn `rule-claims.ts`

`src/server/domain/adhoc-proposals.ts` có: tạo, hủy, liệt kê theo con, liệt kê đang chờ theo gia đình, duyệt, từ chối. Mô tả được chuẩn hóa như lý do của `applyAdhoc` (bỏ khoảng trắng thừa, bắt buộc, tối đa 200 ký tự); số điểm qua `validatePoints`.

Duyệt và từ chối: khóa dòng đề xuất (join `children` để lọc theo gia đình, không thấy thì NOT_FOUND), cập nhật có điều kiện `status = 'pending'`, không cập nhật được thì CONFLICT với cùng thông báo "Yêu cầu này đã được xử lý".

### D3. Giới hạn 5 đề xuất đang chờ, kiểm trong transaction có khóa dòng của con

Khi tạo: mở transaction, `lockChild`, đếm đề xuất `pending` của con, từ 5 trở lên thì từ chối với lỗi nghiệp vụ, ngược lại INSERT.

Lý do: không khóa thì hai lần gửi đồng thời cùng đọc thấy 4 và cùng chèn. `lockChild` là khóa mà sổ cái đang dùng cho mọi thao tác trên cùng một con.

Con số 5 là giả định của bản kế hoạch (người dùng chưa chọn số cụ thể); đặt thành hằng số để đổi dễ.

### D4. Duyệt ghi giao dịch `adhoc` với số điểm bố mẹ chốt

Action duyệt nhận thêm `points` tùy chọn. Bỏ trống thì dùng `proposed_points`; có thì qua `validatePoints`. Số điểm chốt được lưu vào `approved_points` trong cùng lệnh cập nhật trạng thái, rồi gọi `recordTransaction` với:
- `kind: "adhoc"`, `amount`: dương với xin thưởng, âm với tự nhận phạt;
- `description` và `notifyTitle`: mô tả của con;
- `refType: "adhoc_proposal"`, `refId`: id đề xuất;
- `allowArchived: true`, giống duyệt khai rule (spec `family-accounts`: yêu cầu gửi trước khi lưu trữ vẫn xử lý được).

Số điểm không hợp lệ thì transaction hủy, đề xuất vẫn `pending`.

Thông báo cho con sinh ra từ `recordTransaction` (nhận quà hoặc bị trừ điểm) và `notifyRejected` (bị từ chối) như các luồng hiện có, nên `kid-notifications` không cần code riêng.

Đã cân nhắc thêm loại giao dịch mới cho đề xuất của con: phải sửa CHECK của bảng `transactions`, bộ lọc lịch sử và spec `currency-ledger`, trong khi về bản chất đây vẫn là thưởng/phạt ngoài rule. Nguồn gốc "do con đề xuất" đã truy được qua `refType`.

### D5. Màn của con: thêm mục "Việc ngoài rule" ở màn "Rule của nhà mình"

Hai nút "Con xin thưởng" và "Con xin nhận phạt" mở cùng một form: mô tả (bắt buộc), số điểm, nút "Gửi bố mẹ duyệt" và "Thôi". Mục "Đang chờ bố mẹ duyệt" hiện có sẽ liệt kê cả khai rule lẫn đề xuất ngoài rule; đề xuất tự nhận phạt hiển thị số âm. Khi đã đủ 5 đề xuất chờ, hai nút được thay bằng dòng nhắc chờ bố mẹ duyệt.

Không thêm mục điều hướng mới: màn Rule là nơi con đã quen với "Con đã làm".

### D6. Hàng chờ duyệt của bố mẹ: mục mới có ô sửa số điểm

`loadQueue` thêm nguồn thứ tư. Nhãn "Xin thưởng" hoặc "Tự nhận phạt"; tiêu đề là tên con và mô tả; số điểm hiển thị theo dấu. `DecisionForm` nhận ô số "Số điểm" điền sẵn số con đề xuất qua `extra`. Với tự nhận phạt lớn hơn số dư hiện tại, hiện cảnh báo vàng "chỉ trừ được N" như màn Thưởng/Phạt.

## Risks / Trade-offs

- [Con gửi nhiều đề xuất lặt vặt hoặc số điểm rất lớn] → Giới hạn 5 đề xuất chờ; bố mẹ sửa số điểm hoặc từ chối; số điểm tối đa 100 000 như các chỗ nhập điểm khác.
- [Con hụt hẫng khi nhận ít hơn số đã đề xuất mà không rõ vì sao] → Chấp nhận ở bản này (xem Non-Goals); số điểm đề xuất và được duyệt đều được lưu, đủ để sau này hiển thị nếu cần.
- [Mô tả do con viết xuất hiện trong lịch sử giao dịch của gia đình] → Giới hạn 200 ký tự, chuẩn hóa khoảng trắng; hiển thị dạng văn bản thường như lý do đột xuất hiện có.
- [Duyệt đồng thời từ hai bố mẹ] → Cập nhật có điều kiện như khai rule; có test chống race.
- [Con tự nhận phạt rồi bố mẹ duyệt khi số dư đã về 0] → Sổ cái ghi mức gốc và mức thực trừ 0; hàng chờ có cảnh báo trước khi duyệt.

## Migration Plan

Một migration mới chỉ thêm bảng `adhoc_proposals`, không đổi bảng cũ. Migration chạy khi container khởi động như các migration trước. Rollback: triển khai lại image cũ; bảng mới không được code cũ đọc nên để lại không gây hại.

## Open Questions

- Giới hạn 5 đề xuất chờ có hợp với gia đình không? Đổi con số chỉ là sửa một hằng số và một dòng trong spec.
