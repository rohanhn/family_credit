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
- Đạt các mức nghe rõ tối thiểu, độ dài tối đa và âm lượng đỉnh trong spec delta `ui-theme`.
- Kiểm tra được các mức đó bằng unit test, không cần trình duyệt.
- Giữ tính chất từng âm: cao độ, loại sóng, âm phạt trầm và nhỏ hơn âm thưởng.

**Non-Goals:**
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

| Âm | Nốt (Hz), bắt đầu → độ dài (giây) | Tổng độ dài | Nghe rõ (tính bằng hàm ở D3) | Mức tối thiểu trong spec |
|---|---|---|---|---|
| `reward` | 523 (0 → .22), 659 (.14 → .22), 784 (.28 → .22), 1047 (.42 → .6) | 1020 ms | 835 ms | 600 ms |
| `penalty` | 392 (0 → .4), 294 (.34 → .6) | 940 ms | 682 ms | 600 ms |
| `pop` | 660 (0 → .14), 990 (.12 → .22) | 340 ms | 230 ms | 200 ms |
| `coin` | 988 (0 → .14), 1319 (.13 → .42) | 550 ms | 348 ms | 300 ms |

Loại sóng giữ nguyên; âm lượng đỉnh theo D5. Các con số này là điểm xuất phát: khi nghe thử trên máy thật có thể chỉnh, miễn vẫn đạt mức tối thiểu và không vượt 1,5 giây.

### D3. Tính thời gian nghe rõ bằng hàm thuần

Thêm vào `src/ui/sfx.ts` hai hàm thuần, tính từ thông số nốt và đường bao, không dùng Web Audio:
- tổng độ dài của một âm (lúc nốt cuối kết thúc);
- thời gian nghe rõ của một âm: hợp các khoảng mà đường bao của ít nhất một nốt đạt từ −30 dBFS (biên độ 0,0316) trở lên.

`playSfx` và hai hàm này dùng chung một mô tả đường bao (các mốc thời gian và giá trị), để test kiểm đúng thứ được phát.

Đã cân nhắc đo bằng `OfflineAudioContext` trong Playwright: sát thực tế hơn nhưng chậm, cần trình duyệt, và không thêm thông tin vì đường bao là hàm xác định.

### D4. Khoảng chờ trước âm đổi quà lấy từ độ dài âm thưởng

`points-feedback.tsx` dùng tổng độ dài của `reward` (hàm ở D3) cộng một khoảng đệm ngắn 30 ms thay cho hằng số 700 ms. Khi không có điểm cộng, khoảng chờ vẫn là 0.

Lý do: thông số âm thưởng có thể được chỉnh sau khi nghe thử; khoảng chờ tự đi theo.

### D5. Tăng nhẹ âm lượng đỉnh

| Âm | Âm lượng đỉnh cũ | Âm lượng đỉnh mới | Đỉnh mới (dBFS) | Mức tăng |
|---|---|---|---|---|
| `reward` | 0,18 | 0,28 | −11,1 | +3,8 dB |
| `penalty` | 0,16 | 0,24 | −12,4 | +3,5 dB |
| `pop` | 0,14 | 0,22 | −13,2 | +3,9 dB |
| `coin` | 0,06 | 0,10 | −20,0 | +4,4 dB |

Lý do: người dùng yêu cầu tăng "một chút". Mức 3 đến 4 dB là nghe ra khác biệt nhưng chưa thành to gấp đôi (khoảng 10 dB). `coin` dùng sóng vuông, nghe chói hơn các sóng khác ở cùng biên độ, nên vẫn giữ thấp hơn hẳn. `penalty` giữ thấp hơn `reward` để vẫn là âm nhẹ.

Các nốt liền nhau chỉ chồng lên nhau ở đoạn đang tắt dần của nốt trước, nên tổng biên độ không vượt quá khoảng 0,3, còn xa ngưỡng méo tiếng (1,0).

Test "Thông số âm (README §5)" hiện có đang chặn âm lượng đỉnh ở 0,2; đổi giới hạn này thành trần −10 dBFS (biên độ 0,316) của spec.

Đã cân nhắc tăng mạnh hơn (gấp đôi biên độ, +6 dB): dễ thành ồn khi dùng tai nghe hoặc khi bố mẹ ghi thưởng nhiều lần liên tiếp; để dành nếu chạy thử vẫn thấy nhỏ.

## Risks / Trade-offs

- [Kéo dài và tăng nhẹ vẫn chưa đủ nghe trên loa điện thoại, nhất là `coin` ở −20 dBFS] → Chạy thử trên điện thoại thật là task cuối; nếu vẫn không nghe được thì sửa kế hoạch bằng `/opsx:update` để tăng thêm, trong trần −10 dBFS của spec.
- [Âm to hơn gây khó chịu khi dùng tai nghe] → Mức tăng chỉ 3 đến 4 dB và có trần −10 dBFS; nút loa theo thiết bị vẫn tắt được.
- [Không nghe được do nguyên nhân khác: chế độ im lặng của iPhone/iPad, trình duyệt chặn phát, công tắc âm thanh cả gia đình đang tắt] → Ngoài phạm vi change này; task chạy thử ghi lại điều kiện thử (âm lượng media, chế độ im lặng, nút loa) để tách riêng từng nguyên nhân.
- [Âm dài hơn gây khó chịu khi bấm liên tục, ví dụ con báo xong nhiều nhiệm vụ liền nhau] → `pop` giữ dưới 0,4 giây; các âm chồng lên nhau khi bấm nhanh là chấp nhận được.
- [Âm phạt dài và to hơn có thể nặng nề hơn với trẻ] → Giữ sóng sine và cao độ cũ, âm lượng vẫn thấp hơn âm thưởng; nghe thử trong task cuối.
- [Mockup và app lệch thông số] → README mục 5 ghi rõ bảng thông số là của app, mockup giữ bản cũ.

## Open Questions

- Mức tăng 3 đến 4 dB đã đủ chưa? Trả lời được sau khi chạy thử trên máy thật; nếu cần tăng thêm thì chỉ đổi con số ở D5 trong trần của spec, không đổi các task hiện có.
