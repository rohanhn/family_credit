import type { ReactNode } from "react";
import { CoinIcon } from "@/ui/primitives";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-bg px-4 py-10 text-ink">
      <div className="flex items-center gap-2.5">
        <CoinIcon size={40} />
        <span className="font-display text-3xl font-extrabold">Sao nhà mình</span>
      </div>
      <div className="w-full max-w-md rounded-[28px] bg-card p-6 shadow-flat">{children}</div>
    </div>
  );
}
