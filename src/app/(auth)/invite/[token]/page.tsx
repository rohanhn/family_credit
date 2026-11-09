import { Suspense } from "react";
import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { getParentAuth } from "@/server/auth/next";
import { inspectInvite, INVITE_INVALID_MESSAGE } from "@/server/domain/families";
import { ButtonLink } from "@/ui/primitives";
import { AcceptInviteForm } from "../../auth-forms";

export const metadata: Metadata = { title: "Lời mời · Sao nhà mình" };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const status = await inspectInvite(getDb(), token);
  if (!status.valid) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">{INVITE_INVALID_MESSAGE}</h1>
        <p className="text-sm font-semibold text-muted">Liên kết đã hết hạn sau 7 ngày hoặc đã được dùng. Hãy nhờ bố/mẹ tạo lời mời mới.</p>
        <ButtonLink href="/login" variant="outline">
          Về trang đăng nhập
        </ButtonLink>
      </div>
    );
  }
  const auth = await getParentAuth();
  const next = encodeURIComponent(`/invite/${token}`);
  if (!auth) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Bạn được mời vào {status.familyName}</h1>
        <p className="text-sm font-semibold text-muted">Đăng nhập hoặc tạo tài khoản bố mẹ để tham gia.</p>
        <ButtonLink href={`/register?next=${next}`} size="lg">
          Tạo tài khoản
        </ButtonLink>
        <ButtonLink href={`/login?next=${next}`} variant="outline">
          Tôi đã có tài khoản
        </ButtonLink>
      </div>
    );
  }
  if (auth.familyId !== null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-extrabold">Bạn đã thuộc một gia đình</h1>
        <p className="text-sm font-semibold text-muted">Mỗi tài khoản bố mẹ chỉ thuộc một gia đình.</p>
        <ButtonLink href="/parent" variant="outline">
          Về trang của gia đình
        </ButtonLink>
      </div>
    );
  }
  return <AcceptInviteForm token={token} familyName={status.familyName} />;
}

export default function InvitePage(props: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Invite params={props.params} />
    </Suspense>
  );
}
