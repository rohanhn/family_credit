import type { ReactNode } from "react";
import { NavLink } from "./nav-link";
import { CoinIcon } from "./primitives";
import type { ThemeId } from "./themes";

// Khung khu vực bố mẹ (design D6): menu trên cùng tự xuống dòng,
// nội dung chính + cột phụ đặt cạnh nhau trên màn rộng, xếp chồng trên màn hẹp.

export const PARENT_NAV = [
  { href: "/parent", label: "Tổng quan", exact: true },
  { href: "/parent/tasks", label: "Nhiệm vụ" },
  { href: "/parent/apply", label: "Thưởng / Phạt" },
  { href: "/parent/shop", label: "Cửa hàng" },
  { href: "/parent/history", label: "Lịch sử" },
  { href: "/parent/settings", label: "Cài đặt" },
];

export function ParentShell({
  theme,
  familyName,
  actions,
  children,
}: {
  theme: ThemeId;
  familyName: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-theme={theme} className="flex flex-1 flex-col bg-bg text-ink">
      <header className="border-b border-black/5 bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6">
          <span className="flex items-center gap-2.5">
            <CoinIcon size={34} face={false} />
            <span className="font-display text-[22px] font-extrabold">{familyName}</span>
          </span>
          {actions && <div className="ml-auto md:order-last md:ml-0">{actions}</div>}
          <nav aria-label="Điều hướng" className="order-last flex w-full flex-wrap gap-1 md:order-none md:w-auto md:flex-1">
            {PARENT_NAV.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                exact={item.exact}
                className="rounded-xl px-3.5 py-2.5 text-[15px] font-bold text-muted no-underline"
                activeClassName="bg-soft font-extrabold !text-ink"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

/** Nội dung chính + cột phụ; tự xếp chồng khi hẹp. */
export function ParentColumns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">{main}</section>
      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">{aside}</aside>
    </div>
  );
}
