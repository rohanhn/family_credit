import { Suspense, type ReactNode } from "react";
import { getDb } from "@/server/db/client";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { getFamily } from "@/server/domain/families";
import { DeviceMenu } from "./device-menu";
import { ParentShell } from "@/ui/parent-shell";
import { SoundProvider } from "@/ui/sound";
import { SoundToggle } from "@/ui/sound-toggle";
import { effectiveTheme } from "@/ui/themes";

// Khu vực bố mẹ: đọc phiên trong <Suspense> (Cache Components), mọi trang con đều đã qua guard.

async function ParentFrame({ children }: { children: ReactNode }) {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const [family, kids] = await Promise.all([getFamily(db, auth.familyId), listChildren(db, auth.familyId)]);
  return (
    <SoundProvider familyEnabled={family.soundEnabled}>
      <ParentShell
        theme={effectiveTheme(null, family.defaultTheme)}
        familyName={family.name}
        actions={
          // Nút loa theo thiết bị, cùng khóa localStorage với phía con (design D5).
          <div className="flex items-center gap-2">
            <SoundToggle variant="icon" />
            <DeviceMenu kids={kids.map((k) => ({ id: k.id, name: k.name }))} />
          </div>
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
