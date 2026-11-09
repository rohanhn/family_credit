import { Suspense, type ReactNode } from "react";
import { kidLogoutAction } from "@/app/actions/kid";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getFamily } from "@/server/domain/families";
import { Icon } from "@/ui/icons";
import { ICON_BUTTON_CLASS, KidShell } from "@/ui/kid-shell";
import { Button } from "@/ui/primitives";
import { effectiveTheme } from "@/ui/themes";

// Khu vực của con sau khi đăng nhập PIN. Phiên được đọc trong <Suspense> (Cache Components).

async function KidFrame({ children }: { children: ReactNode }) {
  const kid = await requireChild();
  const family = await getFamily(getDb(), kid.familyId);
  const today = new Intl.DateTimeFormat("vi-VN", { timeZone: family.timezone, weekday: "long", day: "numeric", month: "numeric" }).format(new Date());
  return (
    <KidShell
      theme={effectiveTheme(kid.theme, family.defaultTheme)}
      childName={kid.name}
      avatar={kid.avatar}
      familyName={family.name}
      subtitle={today.charAt(0).toUpperCase() + today.slice(1)}
      actions={
        <form action={kidLogoutAction}>
          <button type="submit" aria-label="Thoát" className={ICON_BUTTON_CLASS}>
            <Icon name="logout" />
          </button>
        </form>
      }
      sidebarActions={
        <form action={kidLogoutAction}>
          <Button type="submit" variant="outline" className="w-full">
            <Icon name="logout" size={20} />
            Thoát
          </Button>
        </form>
      }
    >
      {children}
    </KidShell>
  );
}

export default function KidAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-bg font-bold text-muted">Đang tải…</div>}>
      <KidFrame>{children}</KidFrame>
    </Suspense>
  );
}
