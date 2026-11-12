# Tasks

## 1. Dữ liệu và nghiệp vụ

- [x] 1.1 Thêm bảng `adhoc_proposals` vào `src/server/db/schema.ts` theo design D1 và sinh migration bằng `npm run db:generate`; kiểm tra: `npm run db:migrate` chạy được trên database dev, `tests/domain/db-setup.test.ts` qua
- [x] 1.2 Tạo `src/server/domain/adhoc-proposals.ts` với tạo, hủy, liệt kê theo con và liệt kê đang chờ theo gia đình (design D2, D3), kèm `tests/domain/adhoc-proposals.test.ts` cho các scenario của "Con đề xuất thưởng/phạt ngoài rule" và "Giới hạn đề xuất ngoài rule đang chờ" (thiếu mô tả, điểm không hợp lệ, hủy, hủy của con khác, vượt 5, gửi lại sau khi được xử lý); kiểm tra: `npx vitest run tests/domain/adhoc-proposals.test.ts` qua
- [x] 1.3 Thêm duyệt và từ chối vào module (design D4), kèm test cho các scenario của "Bố mẹ duyệt đề xuất ngoài rule" (giữ nguyên điểm, sửa điểm và lưu cả hai số, tự nhận phạt, phạt lớn hơn số dư, điểm sửa không hợp lệ thì vẫn chờ duyệt, từ chối kèm lý do, duyệt lần hai, gia đình khác) và các scenario mới của `kid-notifications` (loại và nội dung thông báo khi duyệt, khi từ chối); kiểm tra: `npx vitest run tests/domain/adhoc-proposals.test.ts` qua
- [x] 1.4 Thêm ca đề xuất của con đã lưu trữ vào `tests/domain/archived-child.test.ts` (vẫn nằm trong danh sách chờ với cờ đã lưu trữ, duyệt và từ chối được) và ca "hai bố mẹ duyệt cùng một đề xuất: chỉ ghi một giao dịch" vào `tests/db/approval-race.test.ts`; kiểm tra: `npm test` qua toàn bộ

## 2. Phía con

- [x] 2.1 Thêm server action gửi và hủy đề xuất vào `src/app/actions/rules.ts`, dùng `requireChild` và chỉ lấy `childId` từ phiên; kiểm tra: `npx tsc --noEmit` và `npm run lint` không lỗi
- [x] 2.2 Thêm mục "Việc ngoài rule" với hai nút "Con xin thưởng", "Con xin nhận phạt" và form vào màn "Rule của nhà mình"; gộp đề xuất đang chờ vào mục "Đang chờ bố mẹ duyệt" kèm nút "Hủy"; ẩn hai nút khi đã đủ 5 đề xuất chờ (design D5); kiểm tra: chạy dev, đăng nhập con, gửi một đề xuất mỗi loại và thấy cả hai trong mục đang chờ, hủy được

## 3. Phía bố mẹ

- [x] 3.1 Thêm server action duyệt (nhận `points` tùy chọn) và từ chối đề xuất vào `src/app/actions/rules.ts`, dùng `requireParentWithFamily`; kiểm tra: `npx tsc --noEmit` và `npm run lint` không lỗi
- [x] 3.2 Thêm đề xuất ngoài rule vào `loadQueue` trong `src/app/parent/approval-queue.tsx` với nhãn "Xin thưởng" hoặc "Tự nhận phạt", ô "Số điểm" điền sẵn và cảnh báo khi phạt lớn hơn số dư (design D6); kiểm tra: chạy dev, đề xuất của con hiện trong "Chờ duyệt", duyệt với số điểm đã sửa thì lịch sử ghi đúng số đó

## 4. Kiểm tra tổng thể

- [x] 4.1 Thêm test e2e: con gửi đề xuất xin thưởng, bố mẹ sửa điểm rồi duyệt, con thấy màn ăn mừng với số điểm đã sửa; con gửi đề xuất tự nhận phạt, bố mẹ từ chối kèm lý do, con thấy lý do; thêm ca phiên của con gọi action duyệt đề xuất bị từ chối vào `tests/e2e/action-authz.spec.ts`; kiểm tra: `npx playwright test` cho các file này qua
- [x] 4.2 Chạy `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx playwright test` và `openspec validate add-kid-adhoc-proposals --strict`; kiểm tra: tất cả qua
- [ ] 4.3 Chạy thử thủ công trên điện thoại: con gửi đề xuất mỗi loại, bố mẹ duyệt một cái với số điểm sửa và từ chối một cái; kiểm tra: số dư, lịch sử, thông báo và hàng chờ đúng như spec, chữ trên form dễ hiểu với con
