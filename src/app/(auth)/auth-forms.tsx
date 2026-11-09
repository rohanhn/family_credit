"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { acceptInviteAction, createFamilyAction, loginAction, registerAction } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/ui/form";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  const next = useSearchParams().get("next") ?? "";
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Bố mẹ đăng nhập</h1>
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Mật khẩu" name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton size="lg">Đăng nhập</SubmitButton>
      <p className="text-center text-sm font-bold text-muted">
        Chưa có tài khoản?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-primary underline">
          Đăng ký
        </Link>
      </p>
      <p className="text-center text-sm font-bold text-muted">
        <Link href="/kid" className="text-primary underline">
          Về màn chọn avatar của con
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, undefined);
  const next = useSearchParams().get("next") ?? "";
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Tạo tài khoản bố mẹ</h1>
      <input type="hidden" name="next" value={next} />
      <Field label="Tên hiển thị" name="displayName" placeholder="Bố, Mẹ…" hint="Hiện ở lịch sử thưởng/phạt" maxLength={30} required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Mật khẩu" name="password" type="password" autoComplete="new-password" minLength={8} hint="Ít nhất 8 ký tự" required />
      <FormMessage state={state} />
      <SubmitButton size="lg">Đăng ký</SubmitButton>
      <p className="text-center text-sm font-bold text-muted">
        Đã có tài khoản?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-primary underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function CreateFamilyForm() {
  const [state, action] = useActionState(createFamilyAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Tạo gia đình</h1>
      <p className="text-sm font-semibold text-muted">Đặt tên cho gia đình. Sau đó bạn thêm các con và mời bố/mẹ còn lại.</p>
      <Field label="Tên gia đình" name="name" placeholder="Nhà Bin & Na" maxLength={50} required />
      <FormMessage state={state} />
      <SubmitButton size="lg">Tạo gia đình</SubmitButton>
      <p className="text-sm font-semibold text-muted">Được bố/mẹ khác mời? Mở liên kết mời họ gửi cho bạn.</p>
    </form>
  );
}

export function AcceptInviteForm({ token, familyName }: { token: string; familyName: string }) {
  const [state, action] = useActionState(acceptInviteAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-extrabold">Tham gia {familyName}</h1>
      <p className="text-sm font-semibold text-muted">Bạn sẽ có quyền ngang bằng với bố/mẹ đã mời.</p>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton size="lg">Tham gia gia đình</SubmitButton>
    </form>
  );
}
