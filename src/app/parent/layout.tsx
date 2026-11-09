import { Suspense, type ReactNode } from "react";
import { enableFamilyModeAction } from "@/app/actions/family";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { getFamily } from "@/server/domain/families";
import { Icon } from "@/ui/icons";
import { ParentShell } from "@/ui/parent-shell";
import { Button } from "@/ui/primitives";
import { SoundProvider } from "@/ui/sound";
import { effectiveTheme } from "@/ui/themes";

// Khu vực bố mẹ: đọc phiên trong <Suspense> (Cache Components), mọi trang con đều đã qua guard.

async function ParentFrame({ children }: { children: ReactNode }) {
  const auth = await requireParentWithFamily();
  const family = await getFamily(getDb(), auth.familyId);
  return (
    <SoundProvider familyEnabled={family.soundEnabled}>
      <ParentShell
        theme={effectiveTheme(null, family.defaultTheme)}
        familyName={family.name}
        actions={
          <form action={enableFamilyModeAction}>
            <Button type="submit">
              <Icon name="phone" size={18} />
              Bật chế độ gia đình
            </Button>
          </form>
        }
      >
        {children}
      </ParentShell>
    </SoundProvider>
  );
}

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-bg font-bold text-muted">Đang tải…</div>}>
      <ParentFrame>{children}</ParentFrame>
    </Suspense>
  );
}
