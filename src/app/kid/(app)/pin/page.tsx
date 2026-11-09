import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/ui/icons";
import { ICON_BUTTON_CLASS } from "@/ui/kid-shell";
import { PinChange } from "./pin-change";

export const metadata: Metadata = { title: "Đổi PIN · Sao nhà mình" };

// Con tự đổi PIN (spec family-accounts "Con đổi PIN"); layout khu vực con đã qua guard.
export default function KidPinPage() {
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href="/kid/home" aria-label="Quay lại" className={`${ICON_BUTTON_CLASS} md:hidden`}>
          <Icon name="back" />
        </Link>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">Đổi PIN của con</h1>
      </div>
      <PinChange />
    </>
  );
}
