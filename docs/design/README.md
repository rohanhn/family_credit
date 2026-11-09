# Thiết kế giao diện (đã chốt từ mockup)

- Mockup tương tác: https://claude.ai/artifact/2yj585pp7RjrxLoEgq2h5k (riêng tư; chia sẻ qua menu Share).
- Bản nguồn mockup: `mockup/*.dc.html` và `mockup/canvas.json`. File chỉ chạy được trong trình xem canvas, dùng để tham chiếu bố cục và thông số; không import vào code.
- Hình SVG dùng lại được: `assets/`. Khi code sẽ chuyển sang `public/avatars/` và `public/themes/<id>/`.
- Spec hành vi nằm ở `openspec/changes/add-family-credit-mvp/specs/`. Tài liệu này chỉ mô tả giao diện.

## 1. Danh sách màn hình

| Mã | File mockup | Khổ | Route dự kiến | Task |
|---|---|---|---|---|
| 1 / W1 | `KidLogin` / `WebKidLogin` | 390 / 1280 | `(kid)/` | 3.6 |
| 2 / W2 | `Main` / `WebKidHome` | 390 / 1280 | `(kid)/home` | 7.3 |
| 3 | `KidCelebrate`: thông báo điểm mới, 2 biến thể thưởng / phạt (điện thoại: toàn màn hình; web: popup trong W2) | 390 | overlay trong `(kid)/home` | 7.3, 7.5 |
| 4 / W3 | `KidShop` / `WebKidShop` | 390 / 1280 | `(kid)/shop` | 6.2 |
| 8 | `KidTheme` | 390 | `(kid)/theme` | 7.2 |
| 5 | `ParentDashboard` | 1280, co giãn | `(parent)/` | 5.5, 6.2 |
| 6 / W4 | `ParentApplyRule` / `WebParentApply` | 390 / 1280 | `(parent)/apply` | 4.2 |
| 7 / W5 | `ParentTaskForm` / `WebParentTasks` | 390 / 1280 | `(parent)/tasks` | 5.5 |

Chưa có mockup: Lịch sử (con, bố mẹ), danh sách Rule cho con, quản lý Rule, quản lý Cửa hàng, Cài đặt (đơn vị tiền tệ, theme gia đình, mời bố mẹ, quản lý con, thiết bị), đăng ký/đăng nhập bố mẹ, màn khóa PIN. Các màn này làm theo cùng hệ thống bên dưới.

Mỗi cặp điện thoại/web là **một trang responsive**, không phải hai trang riêng:
- Màn con: dưới ~768px dùng thanh tab dưới đáy (4 mục); từ ~768px trở lên dùng sidebar trái (thêm mục "Giao diện" và nút Thoát).
- Màn bố mẹ: thanh menu trên cùng, tự xuống dòng khi hẹp; nội dung chính `flex: 999 1 560px`, cột phụ `flex: 1 1 300–340px`, tự xếp chồng trên điện thoại.
- Nội dung tối đa 1200–1240px, căn giữa.

## 2. Theme

Biến CSS đặt trên `[data-theme="<id>"]`. Theme hiệu lực = theme của con nếu có, ngược lại theme mặc định của gia đình.

| Token | sunny | ocean | candy | robot | magic | Dùng cho |
|---|---|---|---|---|---|---|
| `--bg` | `#FFF6DF` | `#E6F5FA` | `#FDEEF6` | `#EEF2F7` | `#FFF3F8` | Nền trang |
| `--card` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | Thẻ, ô nhập |
| `--soft` | `#FFE7A8` | `#C7ECF5` | `#F8D2E8` | `#D6E0EE` | `#FFD9E8` | Nền chip, mục đang chọn, rãnh thanh tiến độ |
| `--ring` | `#FFC94D` | `#7DD3E8` | `#F0A6D6` | `#F5C518` | `#F7C948` | Viền avatar |
| `--primary` | `#C2410C` | `#0E7490` | `#A21CAF` | `#1D4ED8` | `#BE185D` | Nút chính, thẻ số dư, viền chọn |
| `--on-primary` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | Chữ trên `--primary` |
| `--accent` | `#F59E0B` | `#14B8A6` | `#EC4899` | `#E11D2E` | `#E9A400` | Phần đã đầy của thanh tiến độ (không dùng cho chữ) |
| `--ink` | `#2B2118` | `#0F2A33` | `#2E1530` | `#0F172A` | `#3A0F24` | Chữ chính |
| `--muted` | `#6B5644` | `#486570` | `#6E4D6E` | `#475569` | `#7A3B5A` | Chữ phụ |

Tên hiển thị: sunny = "Nắng mai", ocean = "Biển xanh", candy = "Kẹo ngọt", robot = "Robot chiến binh" (gợi ý cho bé trai), magic = "Phép thuật" (gợi ý cho bé gái). Con nào cũng chọn được mọi theme.

Theme `robot` và `magic` có linh vật (`assets/mascot-robot.svg`, `assets/mascot-magic.svg`) hiện trên thẻ số dư và màn ăn mừng. Đây là thiết kế gốc, **không** dùng nhân vật hay tên của Gundam, Card Captor Sakura hay thương hiệu có bản quyền khác.

### Màu cố định (không đổi theo theme)

| Ý nghĩa | Nền | Chữ |
|---|---|---|
| Hoàn thành | `#DCF5E3` | `#166534` |
| Chờ duyệt | `#FFF1C2` | `#7A4A00` (hoặc `#5C3A00`) |
| Nút "+ Thưởng" | `#DCF5E3` | `#14532D` |
| Nút "− Phạt" | `#FDE2E1` | `#8A1C1C` |
| Số điểm cộng / trừ trên nền trắng | — | `#15803D` / `#B91C1C` |
| Đồng "Sao" | `#FFC531`, viền `#8A5A00` | — |

### Độ tương phản (đã đo, WCAG)

Đạt ≥ 4.5:1 cho mọi cặp chữ/nền ở cả 5 theme: `ink` trên `bg`/`soft`, `muted` trên `bg`/`card`/`soft`, `on-primary` trên `primary`, `primary` trên `card`/`bg`, và các màu cố định ở trên.

Ngoại lệ: chữ `primary` trên nền `soft` chỉ đạt 4.25 (sunny) và 4.27 (ocean). **Quy tắc:** trên nền `soft` chỉ dùng `primary` cho icon và đường viền (yêu cầu ≥ 3:1), chữ dùng `ink`. Unit test tương phản ở task 7.1 kiểm tra đúng danh sách cặp này.

## 3. Chữ

- Tiêu đề và số: **Baloo 2** (600/700/800). Nội dung: **Nunito** (500–800). Cả hai hỗ trợ tiếng Việt; tải qua `next/font/google`.
- Cỡ chữ: số dư 52px (điện thoại) / 60px (web); H1 26–36px; tiêu đề mục 22–26px; nội dung 15–18px; chữ phụ 12–14px, không nhỏ hơn 12px.

## 4. Hình khối và thành phần

- Bo góc: thẻ 20–28px, nút 14–18px, chip và thanh tiến độ 99px.
- Bóng: một bóng phẳng phía dưới `0 3px 0 rgba(0,0,0,.05)`; nút chính `0 3–4px 0 rgba(0,0,0,.18)`.
- Vùng bấm phía con tối thiểu 44×44px; nút chính 48–56px.
- Thanh tiến độ: rãnh `--soft`, phần đầy `--accent`, cao 16–18px, kèm chữ "X / Y Sao · Còn Z nữa".
- Nhiệm vụ: chưa làm → nút `--primary` "Con xong rồi"; chờ duyệt → nhãn vàng + "Hủy báo"; xong → nhãn xanh lá; bị từ chối → quay về "chưa làm" và hiện lý do ở dòng phụ. Nhiệm vụ nhóm có chip "Nhiệm vụ nhóm · tên các con".
- Cửa hàng: đủ điểm → nút "Đổi"; thiếu → thanh tiến độ nhỏ + "Còn thiếu N"; phần thưởng là mục tiêu có viền `--primary` và nhãn "Mục tiêu".
- Duyệt nhiệm vụ nhóm: các chip có ô tick cho từng con, mặc định chọn tất cả.
- Thưởng/Phạt: khi mức phạt lớn hơn số dư, hiện cảnh báo vàng "chỉ trừ được N, lịch sử vẫn ghi mức gốc". Bản web có ô "Xem trước" số dư trước và sau.
- Icon: SVG nét (stroke 2–2.2px, đầu tròn), không dùng emoji.
- Hiệu ứng ăn mừng: điện thoại toàn màn hình, web dạng popup; dùng confetti từ `canvas-confetti`; khi bật `prefers-reduced-motion` chỉ hiện "+N".

## 5. Âm thanh

Hiệu ứng âm thanh tổng hợp bằng Web Audio API (oscillator + envelope), không dùng file âm thanh, nên không cần giấy phép và không tăng dung lượng tải. Thông số dưới đây là bản đã nghe thử trong mockup (`playSfx` trong các file `.dc.html`).

| Âm | Khi nào | Sóng | Nốt (Hz), thời điểm bắt đầu → độ dài (giây) | Âm lượng đỉnh |
|---|---|---|---|---|
| `reward` | Con thấy thông báo được cộng điểm; bố mẹ bấm Thưởng | triangle | 523 (0 → .16), 659 (.09 → .16), 784 (.18 → .16), 1047 (.27 → .4) | 0.18 |
| `penalty` | Con thấy thông báo bị trừ điểm; bố mẹ bấm Phạt | sine | 392 (0 → .28), 294 (.22 → .45) | 0.16 |
| `pop` | Con bấm "Con xong rồi"; bật lại âm thanh | sine | 660 (0 → .07), 990 (.06 → .09) | 0.14 |
| `coin` | Yêu cầu đổi thưởng được duyệt (phía con) | square | 988 (0 → .08), 1319 (.08 → .3) | 0.06 |

Envelope: tăng trong 15ms rồi giảm theo hàm mũ về 0.0001.

Nguyên tắc:
- Âm phạt **nhẹ và trầm**, không dùng tiếng còi hay tiếng báo lỗi, để không làm trẻ sợ hay xấu hổ. Màn báo bị trừ dùng nền theme (không dùng nền `primary`), chibi hơi buồn, lời động viên "Không sao, lần sau mình sửa nhé!" và nút "Con hiểu rồi".
- Âm thanh không bao giờ là nơi duy nhất mang thông tin; mọi sự kiện đều có chữ và hình.
- Nút bật/tắt âm thanh: biểu tượng loa ở đầu màn con (điện thoại) và trong sidebar (web). Lưu theo thiết bị (`localStorage`). Bố mẹ có công tắc chung cho cả gia đình trong Cài đặt (mặc định bật).
- Trình duyệt chặn phát âm thanh trước khi người dùng thao tác. Khi đăng nhập PIN (là một thao tác) thì thông báo điểm phát được ngay. Nếu bị chặn (ví dụ tải lại trang), không báo lỗi; âm thanh phát ở lần chạm kế tiếp.
- Khi bật `prefers-reduced-motion` vẫn giữ âm thanh (âm thanh không phải chuyển động); chỉ tắt khi người dùng tắt loa.

## 6. Dữ liệu mẫu dùng trong mockup

Gia đình "Nhà Bin & Na", đơn vị "Sao". Con: Bin 120, Na 45, Su 3. Dùng lại làm seed cho môi trường dev và test e2e.
