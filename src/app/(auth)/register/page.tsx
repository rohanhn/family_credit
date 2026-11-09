import { Suspense } from "react";
import type { Metadata } from "next";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Đăng ký · Sao nhà mình" };

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
