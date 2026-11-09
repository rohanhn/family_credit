# Tasks

## 1. Khởi tạo project

- [ ] 1.1 Tạo app Next.js (TypeScript, App Router, Tailwind, ESLint) ở thư mục gốc repo với cấu trúc `src/app`, `src/server/{db,auth,domain}`, `src/ui`, `tests/{domain,e2e}` theo design D1; kiểm tra `npm run dev` hiển thị trang chủ và `npm run lint` không lỗi
- [ ] 1.2 Cài better-sqlite3, drizzle-orm, drizzle-kit, @node-rs/argon2, vitest, @playwright/test, canvas-confetti; thêm script `test`, `test:e2e`, `db:migrate`; kiểm tra `npm test` chạy được (chưa có test nào)
- [ ] 1.3 Bổ sung `.gitignore` cho `data/`, `.next/`, `node_modules/`, `playwright-report/`; kiểm tra `git status` không liệt kê các thư mục này

## 2. Cơ sở dữ liệu và sổ cái (currency-ledger)

- [ ] 2.1 Viết schema Drizzle cho toàn bộ bảng trong design D3 (gồm `task_assignees` và hai partial unique index của `task_days`) cùng migration đầu tiên, bật WAL và foreign_keys, đọc `DATABASE_PATH`; kiểm tra `npm run db:migrate` tạo được `data/app.db` có đủ bảng
- [ ] 2.2 Thêm trigger SQLite chặn UPDATE/DELETE trên `transactions`; kiểm tra bằng unit test rằng câu UPDATE hoặc DELETE trực tiếp bị lỗi
- [ ] 2.3 Tạo helper test dựng DB in-memory đã migrate, kèm đồng hồ inject được (design D5); kiểm tra bằng một test mẫu
- [ ] 2.4 Viết domain ledger: `getBalance`, `recordTransaction` (áp quy tắc không âm, lưu requested/applied, chạy trong transaction), `recordAdjustment`, `listTransactions` (lọc theo con, khoảng ngày, loại); kiểm tra bằng unit test cho mọi scenario trong `specs/currency-ledger` (số dư sau nhiều giao dịch, phạt vượt số dư, phạt khi số dư 0, điều chỉnh, lọc theo loại)
- [ ] 2.5 Viết domain đơn vị tiền tệ (mặc định "Sao", đổi tên 1–20 ký tự, đổi icon); kiểm tra bằng unit test về giá trị mặc định và độ dài tên

## 3. Gia đình và xác thực (family-accounts)

- [ ] 3.1 Viết domain và auth cho bố mẹ: đăng ký (email duy nhất, mật khẩu ≥ 8 ký tự, argon2id), đăng nhập với thông báo lỗi chung, session token đã băm lưu trong DB, đăng xuất; kiểm tra bằng unit test cho các scenario đăng ký/đăng nhập
- [ ] 3.2 Viết guard `requireParent`/`requireChild` trả về familyId, và giới hạn mọi truy vấn domain theo familyId; kiểm tra bằng unit test rằng truy cập dữ liệu gia đình khác trả về "không tìm thấy", và phiên con không gọi được thao tác của bố mẹ
- [ ] 3.3 Viết domain gia đình và lời mời: tạo gia đình (mỗi bố mẹ tối đa một gia đình), liên kết mời dùng một lần có hạn 7 ngày; kiểm tra bằng unit test cho lời mời hợp lệ, hết hạn, đã dùng
- [ ] 3.4 Viết domain hồ sơ con: tạo/sửa/lưu trữ, PIN 4 chữ số được băm, avatar chọn từ bộ có sẵn; kiểm tra bằng unit test cho PIN sai định dạng và việc con đã lưu trữ không đăng nhập được
- [ ] 3.5 Viết chế độ gia đình và đăng nhập PIN: cookie device, session child 2 giờ, khóa 5 phút sau 5 lần sai, thoát về màn hình chọn avatar, thu hồi thiết bị; kiểm tra bằng unit test về bộ đếm sai và thời gian khóa
- [ ] 3.6 Làm UI: đăng ký, đăng nhập, tạo gia đình, mời bố mẹ, quản lý con, bật chế độ gia đình, màn hình chọn avatar và bàn phím PIN; kiểm tra thủ công luồng từ đăng ký tới con đăng nhập PIN trên trình duyệt

## 4. Rule thưởng/phạt (reward-rules)

- [ ] 4.1 Viết domain rule: tạo/sửa/ẩn/hiện, điểm là số nguyên dương, áp dụng rule (ghi lại tên và điểm lúc áp dụng), thưởng/phạt đột xuất bắt buộc có lý do; kiểm tra bằng unit test cho mọi scenario trong `specs/reward-rules`, gồm cả việc sửa điểm không ảnh hưởng giao dịch cũ
- [ ] 4.2 Làm UI bố mẹ: danh mục rule, áp dụng nhanh cho một con, form thưởng/phạt đột xuất, xem lịch sử có bộ lọc; UI con: danh sách rule chỉ đọc; kiểm tra thủ công rằng áp dụng rule làm số dư thay đổi đúng

## 5. Nhiệm vụ hằng ngày (daily-tasks)

- [ ] 5.1 Viết `familyToday` theo múi giờ gia đình cùng logic tính danh sách nhiệm vụ của một ngày cho từng con (weekdays_mask, effective_from, paused_from, `assign_all`, `task_assignees` còn hiệu lực, loại con đã lưu trữ); kiểm tra bằng unit test qua mốc nửa đêm Asia/Ho_Chi_Minh, ngày không áp dụng, tạm dừng có hiệu lực từ hôm sau, "Tất cả các con" gồm cả con mới, và con lưu trữ không còn nhiệm vụ
- [ ] 5.2 Viết domain tạo/sửa nhiệm vụ: kiểu individual/group, chọn con hoặc "Tất cả" (bắt buộc ít nhất một con), sửa có hiệu lực từ hôm sau; kiểm tra bằng unit test cho các scenario "Giao nhiệm vụ hằng ngày" và "Chọn con được giao nhiệm vụ"
- [ ] 5.3 Viết domain luồng nhiệm vụ riêng (individual): con báo xong hoặc hủy (chỉ trong hôm nay), bố mẹ duyệt/từ chối kèm lý do/tự đánh dấu (tối đa 7 ngày trước), mỗi con cộng điểm đúng một lần; kiểm tra bằng unit test, gồm cả hai con làm cùng một nhiệm vụ và duyệt hai lần
- [ ] 5.4 Viết domain luồng nhiệm vụ nhóm (group): bất kỳ thành viên nào cũng báo hoặc hủy cho cả nhóm, duyệt với danh sách con tham gia (không rỗng, phải thuộc nhóm) và ghi một giao dịch cho mỗi con trong cùng một transaction, từ chối áp dụng cho cả nhóm; kiểm tra bằng unit test cho mọi scenario "Nhiệm vụ cả nhóm làm chung", gồm cả bỏ chọn một con, bỏ chọn tất cả, và duyệt hai lần
- [ ] 5.5 Làm UI: bố mẹ tạo nhiệm vụ có chọn kiểu và chọn con / "Tất cả các con", hàng chờ duyệt của cả gia đình (chọn được ngày trong 7 ngày gần nhất) với danh sách tick người tham gia cho nhiệm vụ nhóm; con xem nhiệm vụ hôm nay, nút "Con xong rồi", nhãn "Nhiệm vụ nhóm" kèm thành viên và người đã báo; kiểm tra thủ công cả hai luồng báo xong → duyệt → số dư tăng

## 6. Cửa hàng đổi thưởng (reward-shop)

- [ ] 6.1 Viết domain cửa hàng: quản lý phần thưởng, gửi/hủy yêu cầu (kiểm tra số dư, chụp lại giá), duyệt (kiểm tra lại số dư trong transaction, trừ theo giá đã chụp)/từ chối, mục tiêu tiết kiệm (bỏ chọn khi phần thưởng bị ẩn); kiểm tra bằng unit test cho mọi scenario trong `specs/reward-shop`, gồm cả hai yêu cầu cùng chờ duyệt khi số dư đã giảm
- [ ] 6.2 Làm UI: bố mẹ quản lý phần thưởng và hàng chờ duyệt đổi thưởng; con xem cửa hàng (đủ hoặc "Còn thiếu N"), gửi/hủy yêu cầu, chọn mục tiêu; kiểm tra thủ công luồng đổi thưởng → duyệt → số dư giảm

## 7. Theme và màn hình con (ui-theme)

- [ ] 7.1 Định nghĩa token màu cho 3 theme `sunny`, `ocean`, `candy` bằng CSS variable trên `[data-theme]`, cùng bộ SVG chibi trong `public/themes/` và `public/avatars/` (ghi nguồn trong `public/CREDITS.md`); kiểm tra bằng unit test rằng mọi cặp chữ/nền đạt tương phản ≥ 4.5:1
- [ ] 7.2 Viết logic theme hiệu lực (theme của con nếu có, ngược lại theme mặc định của gia đình), UI cho bố mẹ chọn theme mặc định và cho con chọn theme hoặc quay về theme gia đình; kiểm tra bằng unit test cho thứ tự ưu tiên, và kiểm tra thủ công việc đổi theme
- [ ] 7.3 Làm màn hình chính của con: avatar, số dư với tên và icon đơn vị tiền tệ, thanh tiến độ mục tiêu, nhiệm vụ hôm nay; hiệu ứng ăn mừng dựa trên `last_seen_txn_id`, tôn trọng `prefers-reduced-motion`; kiểm tra bằng unit test logic "có điểm mới" và kiểm tra thủ công khi bật giảm chuyển động
- [ ] 7.4 Rà responsive mọi màn hình ở 360px và 1280px, vùng bấm phía con tối thiểu 44x44px; kiểm tra bằng Playwright rằng không có thanh cuộn ngang ở 360px trên các trang chính

## 8. Kiểm thử tích hợp và triển khai

- [ ] 8.1 Viết test Playwright cho luồng chính: bố mẹ đăng ký → tạo gia đình → tạo hai con → tạo rule, một nhiệm vụ riêng, một nhiệm vụ nhóm cho "Tất cả các con", phần thưởng → bật chế độ gia đình → con đăng nhập PIN → báo xong nhiệm vụ riêng và nhiệm vụ nhóm → bố mẹ duyệt (nhiệm vụ nhóm cộng điểm cho cả hai con) → con thấy hiệu ứng và đổi thưởng → bố mẹ duyệt → lịch sử đúng; kiểm tra `npm run test:e2e` pass
- [ ] 8.2 Cấu hình `output: "standalone"`, viết Dockerfile (volume `/data`, migration chạy khi khởi động), unit systemd mẫu, `scripts/backup.sh`, lệnh CLI `reset-password`; kiểm tra container khởi động, tạo DB, và script backup tạo được file sao lưu
- [ ] 8.3 Viết `README.md`: chạy dev, biến môi trường, deploy, sao lưu và khôi phục, reset mật khẩu; kiểm tra bằng cách làm theo README trên một thư mục sạch

## Workflow follow-up

- Archive change bằng `/opsx:archive` sau khi review và mọi task đã xong.
