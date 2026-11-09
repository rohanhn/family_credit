"use client";

import { useActionState } from "react";
import { kidSetThemeAction } from "@/app/actions/kid";
import { FormMessage, SubmitButton } from "@/ui/form";
import { ThemePicker } from "@/ui/theme-picker";
import type { ThemeId } from "@/ui/themes";

export function KidThemeForm({ current, familyTheme }: { current: string; familyTheme: ThemeId }) {
  const [state, action] = useActionState(kidSetThemeAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <ThemePicker defaultValue={current} familyTheme={familyTheme} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full md:w-fit" pendingText="Đang đổi…">
        Dùng giao diện này
      </SubmitButton>
    </form>
  );
}
