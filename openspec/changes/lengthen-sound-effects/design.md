# Design

## Context

Xem proposal.md mục Why. Bốn âm được tổng hợp bằng Web Audio trong `src/ui/sfx.ts`: mỗi âm là danh sách nốt `[tần số, bắt đầu, độ dài]`, chung một loại sóng và một âm lượng đỉnh. Đường bao hiện tại của mỗi nốt: tăng tới đỉnh trong 15 ms, rồi giảm theo hàm mũ về 0,0001 đúng lúc hết nốt. Với cách giảm này, biên độ rơi dưới −30 dBFS chỉ sau khoảng một phần tư độ dài nốt.

Số đo hiện tại (dựng bằng `OfflineAudioContext` trong Chromium, 48 kHz):

| Âm | Đỉnh (dBFS) | Nghe rõ (≥ −30 dBFS) | Độ dài danh nghĩa |
|---|---|---|---|
| `reward` | −15,2 | 215 ms | 670 ms |
| `penalty` | −16,1 | 165 ms | 670 ms |
| `pop` | −17,4 | 45 ms | 150 ms |
| `coin` | −24,7 | 50 ms | 380 ms |

`points-feedback.tsx` phát `coin` sau `reward` bằng khoảng chờ cố định 700 ms, khớp với độ dài 670 ms của `reward` hiện tại.

## Goals / Non-Goals

**Goals:**
- Đạt các mức nghe rõ tối thiểu và độ dài tối đa trong spec delta `ui-theme`.
- Kiểm tra được các mức đó bằng unit test, không cần trình duyệt.
- Giữ tính chất từng âm: cao độ, loại sóng, âm phạt nhẹ và trầm.

**Non-Goals:**
- Tăng âm lượng đỉnh. Người dùng yêu cầu kéo dài; âm lượng giữ nguyên để tách riêng tác dụng của việc kéo dài.
- Sửa cách mở khóa âm thanh khi trình duyệt chặn phát trên màn cảm ứng.
- Xử lý việc iPhone/iPad tắt âm khi bật chế độ im lặng.
- Sửa `playSfx` trong các file mockup `docs/design/mockup/*.dc.html`.

## Decisions

### D1. Thêm đoạn giữ đỉnh vào đường bao

Mỗi nốt: tăng tới đỉnh trong 15 ms, giữ đỉnh tới 60% độ dài nốt, rồi giảm theo hàm mũ về 0,0001 đúng lúc hết nốt. Tỷ lệ giữ là một hằng số chung cho mọi âm.

Lý do: phần nghe rõ gần bằng độ dài nốt, nên kéo dài nốt có tác dụng thật. Đoạn giảm hàm mũ ở cuối giữ cho âm tắt mềm, không lách tách.

Đã cân nhắc:
- Chỉ tăng độ dài nốt, giữ đường bao cũ: để `pop` nghe rõ 200 ms cần nốt dài khoảng 800 ms, quá dài cho một tiếng phản hồi khi bấm nút.
- Giảm tuyến tính thay cho hàm mũ: nghe rõ lâu hơn nhưng đuôi âm kết thúc gắt hơn.

### D2. Thông số nốt mới

| Âm | Nốt (Hz), bắt đầu → độ dài (giây) | Tổng độ dài | Nghe rõ ước tính | Mức tối thiểu trong spec |
|---|---|---|---|---|
| `reward` | 523 (0 → .22), 659 (.14 → .22), 784 (.28 → .22), 1047 (.42 → .6) | 1020 ms | khoảng 830 ms | 600 ms |
| `penalty` | 392 (0 → .4), 294 (.34 → .6) | 940 ms | khoảng 750 ms | 600 ms |
| `pop` | 660 (0 → .14), 990 (.12 → .22) | 340 ms | khoảng 270 ms | 200 ms |
| `coin` | 988 (0 → .14), 1319 (.13 → .42) | 550 ms | khoảng 400 ms | 300 ms |

Loại sóng và âm lượng đỉnh giữ nguyên. Các con số này là điểm xuất phát: khi nghe thử trên máy thật có thể chỉnh, miễn vẫn đạt mức tối thiểu và không vượt 1,5 giây.

### D3. Tính thời gian nghe rõ bằng hàm thuần

Thêm vào `src/ui/sfx.ts` hai hàm thuần, tính từ thông số nốt và đường bao, không dùng Web Audio:
- tổng độ dài của một âm (lúc nốt cuối kết thúc);
- thời gian nghe rõ của một âm: hợp các khoảng mà đường bao của ít nhất một nốt đạt từ −30 dBFS (biên độ 0,0316) trở lên.

`playSfx` và hai hàm này dùng chung một mô tả đường bao (các mốc thời gian và giá trị), để test kiểm đúng thứ được phát.

Đã cân nhắc đo bằng `OfflineAudioContext` trong Playwright: sát thực tế hơn nhưng chậm, cần trình duyệt, và không thêm thông tin vì đường bao là hàm xác định.

### D4. Khoảng chờ trước âm đổi quà lấy từ độ dài âm thưởng

`points-feedback.tsx` dùng tổng độ dài của `reward` (hàm ở D3) cộng một khoảng đệm ngắn 30 ms thay cho hằng số 700 ms. Khi không có điểm cộng, khoảng chờ vẫn là 0.

Lý do: thông số âm thưởng có thể được chỉnh sau khi nghe thử; khoảng chờ tự đi theo.

## Risks / Trade-offs

- [Kéo dài vẫn chưa đủ nghe vì âm lượng đỉnh thấp, nhất là `coin` ở −24,7 dBFS] → Chạy thử trên điện thoại thật là task cuối; nếu vẫn không nghe được thì sửa kế hoạch bằng `/opsx:update` để thêm việc tăng âm lượng.
- [Không nghe được do nguyên nhân khác: chế độ im lặng của iPhone/iPad, trình duyệt chặn phát, công tắc âm thanh cả gia đình đang tắt] → Ngoài phạm vi change này; task chạy thử ghi lại điều kiện thử (âm lượng media, chế độ im lặng, nút loa) để tách riêng từng nguyên nhân.
- [Âm dài hơn gây khó chịu khi bấm liên tục, ví dụ con báo xong nhiều nhiệm vụ liền nhau] → `pop` giữ dưới 0,4 giây; các âm chồng lên nhau khi bấm nhanh là chấp nhận được.
- [Âm phạt dài hơn có thể nặng nề hơn với trẻ] → Giữ sóng sine, cao độ và âm lượng cũ; nghe thử trong task cuối.
- [Mockup và app lệch thông số] → README mục 5 ghi rõ bảng thông số là của app, mockup giữ bản cũ.

## Open Questions

- Sau khi kéo dài, có cần tăng âm lượng đỉnh không? Trả lời được sau khi chạy thử trên máy thật; nếu cần thì là một lần sửa kế hoạch riêng, không đổi các task hiện có.
