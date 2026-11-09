import Link from "next/link";
import type { ReactNode } from "react";
import { ChibiAvatar } from "./chibi";
import { Icon, type IconName } from "./icons";
import { NavLink } from "./nav-link";
import type { ThemeId } from "./themes";

// Khung khu vực con (design D6): tab dưới khi hẹp hơn 768px, sidebar từ 768px.

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; sidebarOnly?: boolean };

export const KID_NAV: NavItem[] = [
  { href: "/kid/home", label: "Trang chính", icon: "home" },
  { href: "/kid/shop", label: "Cửa hàng", icon: "gift" },
  { href: "/kid/history", label: "Lịch sử", icon: "history" },
  { href: "/kid/rules", label: "Rule", icon: "list" },
  { href: "/kid/theme", label: "Giao diện", icon: "palette", sidebarOnly: true },
];

export function KidShell({
  theme,
  childName,
  avatar,
  familyName,
  subtitle,
  actions,
  sidebarActions,
  nav = KID_NAV,
  children,
}: {
  theme: ThemeId;
  childName: string;
  avatar: string;
  familyName: string;
  /** Dòng nhỏ trên tên ở header điện thoại, ví dụ ngày hôm nay. */
  subtitle?: string;
  /** Nút ở header điện thoại (loa, chuông, thoát). */
  actions?: ReactNode;
  /** Nút ở cuối sidebar trên màn rộng (âm thanh, thoát). */
  sidebarActions?: ReactNode;
  nav?: NavItem[];
  children: ReactNode;
}) {
  return (
    <div data-theme={theme} className="flex flex-1 flex-col bg-bg text-ink">
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col md:flex-row md:items-start md:gap-6 md:p-6">
        <aside className="hidden flex-col gap-4 rounded-[28px] bg-card p-5 shadow-flat md:flex md:w-60 md:shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex size-16 items-center justify-center rounded-full border-3 border-halo bg-soft">
              <ChibiAvatar avatar={avatar} size={54} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-display text-2xl font-extrabold leading-tight">{childName}</span>
              <span className="truncate text-sm font-bold text-muted">{familyName}</span>
            </span>
          </div>
          <nav aria-label="Điều hướng" className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.exact}
                className="flex min-h-12 items-center gap-2.5 rounded-[14px] px-3.5 text-base font-bold text-muted no-underline"
                activeClassName="bg-soft font-extrabold !text-ink"
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          {sidebarActions && <div className="flex flex-col gap-2">{sidebarActions}</div>}
        </aside>

        <header className="flex items-center gap-2.5 px-4 pt-5 md:hidden">
          <Link href="/kid/theme" aria-label="Đổi giao diện" className="relative flex size-[52px] shrink-0 items-center justify-center rounded-full border-3 border-halo bg-soft">
            <ChibiAvatar avatar={avatar} size={44} />
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-card text-primary shadow-flat">
              <Icon name="palette" size={16} />
            </span>
          </Link>
          <span className="flex min-w-0 flex-1 flex-col">
            {subtitle && <span className="text-sm font-bold text-muted">{subtitle}</span>}
            <span className="truncate font-display text-[22px] font-extrabold leading-tight min-[400px]:text-[26px]">Chào {childName}!</span>
          </span>
          {actions && <div className="flex shrink-0 gap-1.5">{actions}</div>}
        </header>

        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pb-28 pt-4 md:p-0">{children}</main>
      </div>

      <nav
        aria-label="Điều hướng"
        className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-black/5 bg-card px-2 pb-3.5 pt-2 md:hidden"
      >
        {nav
          .filter((item) => !item.sidebarOnly)
          .map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-bold text-muted no-underline"
              activeClassName="font-extrabold !text-primary"
            >
              <Icon name={item.icon} size={26} />
              {item.label}
            </NavLink>
          ))}
      </nav>
    </div>
  );
}

/** Nút vuông 44px chỉ có icon (header điện thoại); luôn kèm aria-label. */
export const ICON_BUTTON_CLASS = "flex size-11 items-center justify-center rounded-[14px] bg-card text-muted shadow-flat";
