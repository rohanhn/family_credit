import type { MetadataRoute } from "next";
import { THEMES, DEFAULT_THEME } from "@/ui/themes";

// Web app manifest để "Thêm vào màn hình chính" (spec ui-theme "Cài ứng dụng lên màn hình chính",
// design D6). Mở từ màn hình chính thì vào `/`, proxy chuyển tới đúng nơi theo trạng thái thiết bị.
export default function manifest(): MetadataRoute.Manifest {
  const tokens = THEMES[DEFAULT_THEME].tokens;
  return {
    name: "Sao nhà mình",
    short_name: "Sao nhà mình",
    description: "Thưởng, phạt và nhiệm vụ hằng ngày cho cả gia đình.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: tokens.bg,
    theme_color: tokens.primary,
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
