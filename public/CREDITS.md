# Nguồn hình ảnh

Mọi hình trong `public/avatars/` và `public/themes/` là thiết kế gốc của dự án, vẽ tay bằng SVG trong `docs/design/assets/` (design D6). Không dùng nhân vật, tên hay biểu tượng của thương hiệu có bản quyền.

| File | Nguồn | Tác giả | Giấy phép |
|---|---|---|---|
| `avatars/<id>.svg` (6 biến thể tóc: `boy-brown`, `girl-buns`, `boy-black`, `girl-black`, `boy-ginger`, `girl-brown`) | `docs/design/assets/avatar-chibi.svg`, đổi màu tóc và thêm búi tóc theo `src/lib/avatars.ts` | Nhóm dự án family_credit | Cùng giấy phép với mã nguồn của repo |
| `themes/<id>/currency-star.svg` (5 theme) | `docs/design/assets/currency-star.svg` | Nhóm dự án family_credit | Cùng giấy phép với mã nguồn của repo |
| `themes/robot/mascot.svg` | `docs/design/assets/mascot-robot.svg` | Nhóm dự án family_credit | Cùng giấy phép với mã nguồn của repo |
| `themes/magic/mascot.svg` | `docs/design/assets/mascot-magic.svg` | Nhóm dự án family_credit | Cùng giấy phép với mã nguồn của repo |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png`, `src/app/apple-icon.png` | Dựng từ `themes/sunny/currency-star.svg` trên nền `soft` của theme sunny | Nhóm dự án family_credit | Cùng giấy phép với mã nguồn của repo |

Âm thanh được tổng hợp bằng Web Audio API (`src/ui/sfx.ts`), không có file âm thanh nên không cần ghi nguồn.

Khi thay bộ hình chính thức, giữ nguyên tên file và cập nhật bảng này.
