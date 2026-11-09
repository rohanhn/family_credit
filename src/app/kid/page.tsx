import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { listKidsForDevice } from "@/server/auth/family-mode";
import { getDeviceAuth } from "@/server/auth/next";
import { getFamily } from "@/server/domain/families";
import { ButtonLink } from "@/ui/primitives";
import { effectiveTheme } from "@/ui/themes";
import { PinLogin } from "./pin-login";

export const metadata: Metadata = { title: "Ai đang dùng máy? · Sao nhà mình" };

async function KidPicker() {
  const device = await getDeviceAuth();
  if (!device) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg px-4 text-center text-ink">
        <h1 className="font-display text-3xl font-extrabold">Thiết bị chưa bật chế độ gia đình</h1>
        <p className="max-w-md font-semibold text-muted">Bố mẹ đăng nhập rồi bấm “Bật chế độ gia đình” trên thiết bị này để các con đăng nhập bằng PIN.</p>
        <ButtonLink href="/login" size="lg">
          Bố mẹ đăng nhập
        </ButtonLink>
      </div>
    );
  }
  const db = getDb();
  const [family, kids] = await Promise.all([getFamily(db, device.familyId), listKidsForDevice(db, device.familyId)]);
  return (
    <div data-theme={effectiveTheme(null, family.defaultTheme)} className="flex flex-1 flex-col items-center gap-8 bg-bg px-4 py-10 text-ink">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-extrabold uppercase tracking-wide text-muted">{family.name}</span>
        <h1 className="font-display text-3xl font-extrabold md:text-[44px]">Ai đang dùng máy?</h1>
      </div>
      {kids.length === 0 ? (
        <p className="font-semibold text-muted">Gia đình chưa có hồ sơ con nào. Bố mẹ thêm con trong phần Cài đặt.</p>
      ) : (
        <PinLogin kids={kids.map((k) => ({ id: k.id, name: k.name, avatar: k.avatar, locked: k.locked }))} />
      )}
      <Link href="/login" className="font-extrabold text-muted underline">
        Bố mẹ đăng nhập
      </Link>
    </div>
  );
}

export default function KidPickerPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center bg-bg font-bold text-muted">Đang tải…</div>}>
      <KidPicker />
    </Suspense>
  );
}
