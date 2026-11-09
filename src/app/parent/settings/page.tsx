import { Suspense } from "react";
import type { Metadata } from "next";
import { logoutAction } from "@/app/actions/auth";
import { getDb } from "@/server/db/client";
import { listDevices } from "@/server/auth/family-mode";
import { requireParentWithFamily } from "@/server/auth/next";
import { listChildren } from "@/server/domain/children";
import { CURRENCY_ICONS, getCurrency } from "@/server/domain/currency";
import { listParents } from "@/server/domain/families";
import { Button, Card } from "@/ui/primitives";
import { AddChildForm, ChangePasswordForm, ChildRow, CurrencyForm, DeviceRow, InviteBox } from "./settings-forms";

export const metadata: Metadata = { title: "Cài đặt · Sao nhà mình" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="font-display text-2xl font-extrabold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Settings() {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const [kids, devices, parentsList, currency] = await Promise.all([
    listChildren(db, auth.familyId),
    listDevices(db, auth.familyId),
    listParents(db, auth.familyId),
    getCurrency(db, auth.familyId),
  ]);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
        <h1 className="font-display text-3xl font-extrabold">Cài đặt</h1>
        <Section id="con" title="Các con">
          {kids.map((k) => (
            <ChildRow key={k.id} child={k} />
          ))}
          <Card>
            <AddChildForm />
          </Card>
        </Section>
        <Section id="thiet-bi" title="Thiết bị chế độ gia đình">
          <Card>
            {devices.length === 0 ? (
              <p className="font-semibold text-muted">Chưa có thiết bị nào. Bấm “Bật chế độ gia đình” trên thiết bị con dùng.</p>
            ) : (
              devices.map((d) => <DeviceRow key={d.id} device={{ id: d.id, createdAt: d.createdAt.toISOString(), expiresAt: d.expiresAt.toISOString() }} />)
            )}
          </Card>
        </Section>
      </div>
      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-8">
        <Section id="bo-me" title="Bố mẹ">
          <Card className="flex flex-col gap-3">
            <ul className="flex flex-col gap-1">
              {parentsList.map((p) => (
                <li key={p.id} className="font-bold">
                  {p.displayName} <span className="text-sm font-semibold text-muted">· {p.email}</span>
                </li>
              ))}
            </ul>
            <InviteBox />
          </Card>
        </Section>
        <Section id="tien-te" title="Đơn vị tiền tệ">
          <Card>
            <CurrencyForm name={currency.name} icon={currency.icon} icons={CURRENCY_ICONS} />
          </Card>
        </Section>
        <Section id="tai-khoan" title="Tài khoản của bạn">
          <Card className="flex flex-col gap-4">
            <ChangePasswordForm />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Đăng xuất
              </Button>
            </form>
          </Card>
        </Section>
      </aside>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="font-bold text-muted">Đang tải…</p>}>
      <Settings />
    </Suspense>
  );
}
