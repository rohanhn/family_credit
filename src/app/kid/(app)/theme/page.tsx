import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { requireChild } from "@/server/auth/next";
import { getFamily } from "@/server/domain/families";
import { Icon } from "@/ui/icons";
import { ICON_BUTTON_CLASS } from "@/ui/kid-shell";
import { effectiveTheme, FAMILY_THEME, isThemeId } from "@/ui/themes";
import { KidThemeForm } from "./theme-form";

export const metadata: Metadata = { title: "Giao diện · Sao nhà mình" };

// Màn con chọn theme (mockup KidTheme, spec ui-theme "Con tự chọn theme").
async function KidTheme() {
  const kid = await requireChild();
  const family = await getFamily(getDb(), kid.familyId);
  const familyTheme = effectiveTheme(null, family.defaultTheme);
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/kid/home" aria-label="Quay lại" className={`${ICON_BUTTON_CLASS} md:hidden`}>
          <Icon name="back" />
        </Link>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">Chọn giao diện của con</h1>
      </div>
      <KidThemeForm current={isThemeId(kid.theme) ? kid.theme : FAMILY_THEME} familyTheme={familyTheme} />
    </>
  );
}

export default function KidThemePage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <KidTheme />
    </Suspense>
  );
}
