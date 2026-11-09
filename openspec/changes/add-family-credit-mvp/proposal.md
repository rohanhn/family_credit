# Proposal

## Why

Bố mẹ cần một cách nhất quán, minh bạch và vui vẻ để thưởng hoặc phạt con theo hành vi và nhiệm vụ hằng ngày. Hiện việc này làm bằng lời hoặc ghi chép rời rạc, nên dễ quên, dễ tranh cãi và không xem lại được lịch sử. Bản MVP này đưa ý tưởng "mỗi gia đình một đồng tiền riêng" (xem `docs/raw/requirements/20261109_khaosat.md`) thành một ứng dụng web chạy được. Trẻ tự thấy số dư và mục tiêu của mình, bố mẹ giữ quyền quyết định.

## What Changes

- Tạo ứng dụng web responsive (mới hoàn toàn), tự host.
- **Gia đình và tài khoản**: bố mẹ đăng ký và đăng nhập bằng email + mật khẩu, tạo gia đình, mời thêm bố/mẹ khác, tạo hồ sơ cho từng con. Con đăng nhập trên thiết bị gia đình bằng cách chọn avatar và nhập PIN, có màn hình riêng.
- **Đơn vị tiền tệ và sổ cái**: mỗi gia đình có đúng một đơn vị tiền tệ, tên và icon tùy chỉnh (ví dụ "Sao", "Phút game"). Mọi biến động điểm được ghi thành một dòng trong sổ cái chỉ ghi thêm. Số dư không bao giờ âm. Bố mẹ và con xem được lịch sử.
- **Rule thưởng/phạt**: bố mẹ tạo, sửa, tạm ẩn các rule hành động kèm số điểm cộng/trừ, rồi áp dụng rule cho một con. Con cũng tự khai được rule thưởng mình đã làm; bố mẹ duyệt thì mới được cộng điểm. Bố mẹ cũng có thể thưởng/phạt đột xuất ngoài rule. Khi phạt vượt số dư, chỉ trừ tối đa bằng số dư hiện có.
- **Nhiệm vụ hằng ngày**: bố mẹ giao nhiệm vụ lặp lại theo ngày, riêng cho một con hoặc chung cho nhiều con (chọn từng con hoặc "Tất cả các con"). Nhiệm vụ chung có hai kiểu: *mỗi con làm riêng* (mỗi con báo xong và được cộng điểm độc lập) hoặc *cả nhóm làm chung* (một trạng thái chung, khi duyệt mỗi con tham gia được cộng đủ điểm). Con báo đã xong, bố mẹ duyệt thì mới được cộng điểm. Bố mẹ cũng có thể tự đánh dấu hoàn thành.
- **Cửa hàng đổi thưởng**: bố mẹ tạo danh mục phần thưởng kèm giá. Con gửi yêu cầu đổi, bố mẹ duyệt thì mới trừ điểm. Con chọn một phần thưởng làm mục tiêu và thấy thanh tiến độ tới đó.
- **Thông báo cho con**: mỗi khi bố mẹ duyệt một yêu cầu (nhiệm vụ, khai rule, đổi thưởng), thưởng/phạt, hoặc từ chối, con nhận thông báo trong app: chuông có số chưa đọc và màn "nhận quà" khi mở app. Khi đang mở app, thông báo mới hiện trong vòng 30 giây.
- **Giao diện và theme**: màu tươi sáng, phong cách chibi, hiệu ứng khi được cộng điểm, thông báo nhẹ nhàng khi bị trừ điểm, âm thanh khi thưởng/phạt (tắt được trên từng thiết bị hoặc cho cả gia đình). Bố mẹ đặt theme mặc định cho gia đình, mỗi con tự chọn theme cho màn hình của mình.

Ngoài phạm vi MVP: level/XP, huy hiệu, streak; nhiều đơn vị tiền tệ trong một gia đình; số dư âm; con tự tạo hoặc sửa rule; thông báo đẩy/email; ứng dụng di động gốc.

Giả định (có thể chỉnh khi review):
- Tài liệu gốc ghi "bố mẹ và con cùng thiết lập rule". Trong MVP, việc thống nhất rule diễn ra ngoài đời; trong app, chỉ bố mẹ được tạo/sửa rule; con xem được danh sách rule và khai rule thưởng (không khai được rule phạt).
- Chỉ bố mẹ được ghi vào sổ cái. Con chỉ tạo yêu cầu (báo xong nhiệm vụ, khai rule thưởng, xin đổi thưởng).
- Một "ngày" tính theo múi giờ của gia đình (mặc định Asia/Ho_Chi_Minh).
- Nhiệm vụ nhóm: bất kỳ con nào trong nhóm cũng báo xong được cho cả nhóm. Khi duyệt, bố mẹ bỏ tick được những con không tham gia. Mỗi con được tick nhận đủ số điểm, không chia nhỏ.
- Khai rule lưu lại số điểm lúc khai; sửa rule trong lúc chờ duyệt không đổi số điểm của yêu cầu. Con khai cùng một rule nhiều lần được, bố mẹ quyết định từng lần.
- Thông báo chỉ có trong app (cập nhật bằng cách hỏi lại server định kỳ), không có push hay email; con cũng nhận thông báo khi bị trừ điểm hoặc bị từ chối.

## Capabilities

### New Capabilities
- `family-accounts`: gia đình, tài khoản bố mẹ (email + mật khẩu), hồ sơ con, đăng nhập con bằng avatar + PIN, phân quyền bố mẹ/con.
- `currency-ledger`: đơn vị tiền tệ của gia đình, sổ cái chỉ ghi thêm, quy tắc số dư không âm, lịch sử giao dịch.
- `reward-rules`: danh mục rule thưởng/phạt, áp dụng rule, con khai rule thưởng và bố mẹ duyệt, thưởng/phạt đột xuất.
- `daily-tasks`: nhiệm vụ hằng ngày riêng hoặc chung (mỗi con làm riêng / cả nhóm làm chung), chọn con được giao, luồng con báo xong → bố mẹ duyệt → cộng điểm.
- `reward-shop`: danh mục phần thưởng, yêu cầu đổi thưởng và duyệt, mục tiêu tiết kiệm.
- `ui-theme`: giao diện responsive, theme chibi tùy chọn (mặc định gia đình + lựa chọn của từng con), phản hồi trực quan khi điểm thay đổi.
- `kid-notifications`: thông báo cho con về kết quả duyệt, thưởng/phạt và từ chối; chuông số chưa đọc; đánh dấu đã đọc.

### Modified Capabilities
<!-- Không có: project chưa có spec nào. -->

## Impact

- Codebase mới: ứng dụng Next.js (TypeScript) ở thư mục gốc repo, dữ liệu trong một database PostgreSQL riêng.
- Dependency mới: Next.js/React, driver PostgreSQL + ORM (Drizzle), thư viện băm mật khẩu, framework test.
- Vận hành: image Docker build bằng GitHub Actions và lưu trên GHCR; VPS chỉ kéo image về chạy, sau gateway Traefik có sẵn, tại `https://app3.domain.xyz`; dùng server PostgreSQL có sẵn trên VPS với database và role riêng; sao lưu bằng `pg_dump` hằng ngày.
- Dữ liệu: có thông tin cá nhân của trẻ (tên, avatar). Mật khẩu và PIN phải được băm, không lưu dạng rõ.
