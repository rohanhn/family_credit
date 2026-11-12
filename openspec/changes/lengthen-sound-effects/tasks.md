# Tasks

## 1. Đường bao và thông số âm

- [ ] 1.1 Trong `src/ui/sfx.ts`, tách mô tả đường bao của một nốt (tăng 15 ms, giữ đỉnh tới 60% độ dài nốt, giảm hàm mũ về 0,0001) thành dữ liệu dùng chung, cho `playSfx` dựng đường bao từ đó (design D1); kiểm tra: `npx tsc --noEmit` và `npm run lint` không lỗi
- [ ] 1.2 Thêm hai hàm thuần tính tổng độ dài và thời gian nghe rõ (≥ −30 dBFS) của một âm (design D3), kèm test trong `tests/domain/sfx.test.ts` với một âm mẫu một nốt và một âm mẫu hai nốt chồng nhau có kết quả tính tay; kiểm tra: `npx vitest run tests/domain/sfx.test.ts` qua
- [ ] 1.3 Đổi thông số nốt của `reward`, `penalty`, `pop`, `coin` theo bảng design D2, giữ loại sóng và âm lượng đỉnh; thêm test cho từng âm: thời gian nghe rõ đạt mức tối thiểu trong spec (600/600/200/300 ms) và tổng độ dài không quá 1,5 giây; kiểm tra: `npx vitest run tests/domain/sfx.test.ts` qua, test "Thông số âm (README §5)" hiện có vẫn qua
- [ ] 1.4 Cập nhật bảng thông số và mô tả đường bao trong `docs/design/README.md` mục 5, ghi rõ bảng là thông số của app còn mockup giữ bản cũ; kiểm tra: số trong bảng khớp `SFX` trong `src/ui/sfx.ts`

## 2. Âm đổi quà phát sau âm thưởng

- [ ] 2.1 Trong `src/app/kid/(app)/points-feedback.tsx`, thay khoảng chờ cố định 700 ms bằng tổng độ dài của `reward` cộng 30 ms, giữ khoảng chờ 0 khi không có điểm cộng (design D4); thêm test rằng khoảng chờ không nhỏ hơn tổng độ dài của `reward`; kiểm tra: `npm test` qua toàn bộ

## 3. Kiểm tra tổng thể

- [ ] 3.1 Chạy `npx tsc --noEmit`, `npm run lint`, `npm test` và `npx playwright test tests/e2e/parent-sound.spec.ts`; kiểm tra: tất cả qua
- [ ] 3.2 Chạy thử thủ công trên một điện thoại Android và một iPhone hoặc iPad, âm lượng media ở mức cao, iPhone/iPad tắt chế độ im lặng, nút loa đang bật: nghe được âm khi bật lại loa, khi con bấm "Con xong rồi", ở màn ăn mừng (kể cả màn có quà được duyệt: âm đổi quà đến sau âm thưởng), ở màn báo bị trừ, và khi bố mẹ bấm Thưởng/Phạt; ghi lại âm nào vẫn không nghe được để quyết định có tăng âm lượng không
