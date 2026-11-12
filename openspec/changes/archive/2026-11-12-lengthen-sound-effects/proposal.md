# Proposal

## Why

Trên điện thoại và máy tính bảng (cả iOS lẫn Android), người dùng không nghe được âm thanh nào của app. Đo lại bốn âm đang tổng hợp cho thấy phần nghe rõ rất ngắn: âm "pop" chỉ khoảng 45 ms, âm đổi quà khoảng 50 ms, âm thưởng khoảng 215 ms và âm phạt khoảng 165 ms, dù độ dài danh nghĩa là 150 đến 670 ms. Nguyên nhân là mỗi nốt vừa lên tới đỉnh đã tắt dần ngay theo hàm mũ, nên phần lớn độ dài của nốt gần như im lặng.

## What Changes

- Kéo dài cả bốn âm (thưởng, phạt, "pop" khi con báo xong hoặc bật lại loa, đổi quà): mỗi nốt giữ ở âm lượng đỉnh một đoạn rồi mới tắt dần, và độ dài từng nốt được tăng lên.
- Tăng nhẹ âm lượng đỉnh của cả bốn âm (khoảng 3 đến 4 dB), âm phạt vẫn nhỏ hơn âm thưởng.
- Đặt mức tối thiểu cho thời gian nghe rõ của từng âm để kiểm tra được bằng test, và mức tối đa để âm không gây khó chịu.
- Âm đổi quà phát sau khi âm thưởng kết thúc, tính theo độ dài mới của âm thưởng thay cho con số cố định 700 ms.
- Cập nhật bảng thông số âm trong `docs/design/README.md` mục 5.

Không đổi: cao độ các nốt, loại sóng, thời điểm phát từng âm, nút loa theo thiết bị và công tắc âm thanh cả gia đình.

## Capabilities

### New Capabilities

Không có.

### Modified Capabilities

- `ui-theme`: thêm yêu cầu về thời gian nghe rõ tối thiểu và độ dài tối đa của từng âm phản hồi, yêu cầu về âm lượng đỉnh, và yêu cầu âm đổi quà không chồng lên âm thưởng. Requirement "Âm thanh phản hồi" hiện có giữ nguyên.

## Impact

- `src/ui/sfx.ts`: thông số bốn âm (nốt, âm lượng đỉnh) và đường bao âm lượng của mỗi nốt.
- `src/app/kid/(app)/points-feedback.tsx`: khoảng chờ trước khi phát âm đổi quà.
- `tests/domain/sfx.test.ts`: thêm test cho thời gian nghe rõ, độ dài và âm lượng đỉnh; nới giới hạn âm lượng trong test hiện có.
- `docs/design/README.md` mục 5: bảng thông số và mô tả đường bao.
- Không đổi cơ sở dữ liệu, API, thư viện phụ thuộc hay cấu hình triển khai.
