import { Suspense, type ReactNode } from "react";
import { kidLogoutAction } from "@/app/actions/kid";
import { kidUnreadAction } from "@/app/actions/notifications";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getCurrency } from "@/server/domain/currency";
import { getFamily } from "@/server/domain/families";
import { Icon } from "@/ui/icons";
import { ICON_BUTTON_CLASS, KidShell } from "@/ui/kid-shell";
import { Button } from "@/ui/primitives";
import { SoundProvider } from "@/ui/sound";
import { SoundToggle } from "@/ui/sound-toggle";
import { effectiveTheme } from "@/ui/themes";
import { KidNotificationsProvider } from "./kid-notifications";
import { NotificationBell } from "./notification-bell";

// Khu vực của con sau khi đăng nhập PIN. Phiên được đọc trong <Suspense> (Cache Components).

async function KidFrame({ children }: { children: ReactNode }) {
  const kid = await requireChild();
  const db = getDb();
  const [family, currency, unread] = await Promise.all([getFamily(db, kid.familyId), getCurrency(db, kid.familyId), kidUnreadAction()]);
  const theme = effectiveTheme(kid.theme, family.defaultTheme);
  const today = new Intl.DateTimeFormat("vi-VN", { timeZone: family.timezone, weekday: "long", day: "numeric", month: "numeric" }).format(new Date());
  return (
    <SoundProvider familyEnabled={family.soundEnabled}>
      <KidNotificationsProvider
        initial={unread}
        profile={{ name: kid.name, avatar: kid.avatar, currencyName: currency.name, currencyIcon: currency.icon, theme, timezone: family.timezone }}
      >
        <KidShell
          theme={theme}
          childName={kid.name}
          avatar={kid.avatar}
          familyName={family.name}
          subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
          actions={
            <>
              <SoundToggle variant="icon" />
            <NotificationBell variant="icon" currencyName={currency.name} />
              <form action={kidLogoutAction}>
                <button type="submit" aria-label="Thoát" className={ICON_BUTTON_CLASS}>
                  <Icon name="logout" />
                </button>
              </form>
            </>
          }
          sidebarActions={
            <>
              <NotificationBell variant="sidebar" currencyName={currency.name} />
            <SoundToggle variant="sidebar" />
              <form action={kidLogoutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <Icon name="logout" size={20} />
                  Thoát
                </Button>
              </form>
            </>
          }
        >
          {children}
        </KidShell>
      </KidNotificationsProvider>
    </SoundProvider>
  );
}

export default function KidAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-bg font-bold text-muted">Đang tải…</div>}>
      <KidFrame>{children}</KidFrame>
    </Suspense>
  );
}
