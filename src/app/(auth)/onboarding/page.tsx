import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireParent } from "@/server/auth/next";
import { CreateFamilyForm } from "../auth-forms";

export const metadata: Metadata = { title: "Tạo gia đình · Sao nhà mình" };

async function Onboarding() {
  const auth = await requireParent();
  if (auth.familyId !== null) redirect("/parent");
  return <CreateFamilyForm />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Onboarding />
    </Suspense>
  );
}
