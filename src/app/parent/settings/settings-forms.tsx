"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import {
  addChildAction,
  archiveChildAction,
  createInviteAction,
  revokeDeviceAction,
  updateChildAction,
  updateCurrencyAction,
} from "@/app/actions/family";
import { AvatarPicker } from "@/ui/avatar-picker";
import { ChibiAvatar } from "@/ui/chibi";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button, Card } from "@/ui/primitives";

const CURRENCY_ICON_LABELS: Record<string, string> = {
  star: "Ngôi sao",
  coin: "Đồng xu",
  clock: "Đồng hồ",
  heart: "Trái tim",
  gem: "Viên ngọc",
  game: "Tay cầm game",
};

export function AddChildForm() {
  const [state, action] = useActionState(addChildAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3" key={state?.message}>
      <h3 className="text-lg font-extrabold">Thêm con</h3>
      <Field label="Tên hiển thị" name="name" maxLength={30} required />
      <AvatarPicker idPrefix="new" />
      <Field label="PIN 4 chữ số" name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" hint="Con dùng PIN này để đăng nhập trên thiết bị gia đình" required />
      <FormMessage state={state} />
      <SubmitButton>Thêm con</SubmitButton>
    </form>
  );
}

export function ChildRow({ child }: { child: { id: number; name: string; avatar: string } }) {
  const [editing, setEditing] = useState(false);
  const [saveState, save] = useActionState(updateChildAction, undefined);
  const [archiveState, archive] = useActionState(archiveChildAction, undefined);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ChibiAvatar avatar={child.avatar} size={48} />
        <span className="flex-1 text-lg font-extrabold">{child.name}</span>
        <Button variant="outline" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? "Đóng" : "Sửa"}
        </Button>
      </div>
      <FormMessage state={saveState ?? archiveState} />
      {editing && (
        <>
          <form action={save} className="flex flex-col gap-3">
            <input type="hidden" name="childId" value={child.id} />
            <Field label="Tên hiển thị" name="name" defaultValue={child.name} maxLength={30} required />
            <AvatarPicker idPrefix={`c${child.id}`} defaultValue={child.avatar} />
            <Field label="PIN mới (để trống nếu không đổi)" name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" />
            <SubmitButton>Lưu</SubmitButton>
          </form>
          <form
            action={archive}
            onSubmit={(e) => {
              if (!confirm(`Lưu trữ hồ sơ của ${child.name}? Con sẽ không đăng nhập được nữa, lịch sử vẫn được giữ.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="childId" value={child.id} />
            <SubmitButton variant="penalty">Lưu trữ hồ sơ</SubmitButton>
          </form>
        </>
      )}
    </Card>
  );
}

export function InviteBox() {
  const [state, action] = useActionState(createInviteAction, undefined);
  const [copied, setCopied] = useState(false);
  const url = state?.data?.url;
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted">Liên kết dùng một lần, hết hạn sau 7 ngày. Người được mời có quyền ngang bằng bạn.</p>
      {url && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-soft p-3">
          <label className="text-[13px] font-extrabold text-muted" htmlFor="invite-url">
            Gửi liên kết này cho bố/mẹ còn lại
          </label>
          <input id="invite-url" readOnly value={url} className="min-h-11 rounded-xl bg-card px-3 text-sm font-bold" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Đã chép" : "Chép liên kết"}
          </Button>
        </div>
      )}
      <FormMessage state={state?.error ? state : undefined} />
      <SubmitButton variant={url ? "outline" : "primary"}>{url ? "Tạo liên kết khác" : "Tạo liên kết mời"}</SubmitButton>
    </form>
  );
}

export function DeviceRow({ device }: { device: { id: string; createdAt: string; expiresAt: string } }) {
  const [state, action] = useActionState(revokeDeviceAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 border-b border-black/5 py-2.5 last:border-0">
      <input type="hidden" name="deviceId" value={device.id} />
      <span className="flex flex-1 flex-col">
        <span className="font-extrabold">Thiết bị bật ngày {new Date(device.createdAt).toLocaleDateString("vi-VN")}</span>
        <span className="text-sm font-semibold text-muted">Hết hạn {new Date(device.expiresAt).toLocaleDateString("vi-VN")}</span>
      </span>
      <SubmitButton variant="outline">Thu hồi</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3" key={state?.message}>
      <Field label="Mật khẩu hiện tại" name="currentPassword" type="password" autoComplete="current-password" required />
      <Field label="Mật khẩu mới" name="newPassword" type="password" autoComplete="new-password" minLength={8} hint="Ít nhất 8 ký tự" required />
      <Field label="Nhập lại mật khẩu mới" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      <FormMessage state={state} />
      <SubmitButton>Đổi mật khẩu</SubmitButton>
    </form>
  );
}

export function CurrencyForm({ name, icon, icons }: { name: string; icon: string; icons: readonly string[] }) {
  const [state, action] = useActionState(updateCurrencyAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Tên đơn vị" name="name" defaultValue={name} maxLength={20} hint="Ví dụ: Sao, Phút game" required />
      <label className="flex flex-col gap-1 text-[13px] font-extrabold text-muted">
        Icon
        <select name="icon" defaultValue={icon} className="min-h-11 rounded-xl border-2 border-black/15 bg-card px-3 text-base font-bold text-ink">
          {icons.map((i) => (
            <option key={i} value={i}>
              {CURRENCY_ICON_LABELS[i] ?? i}
            </option>
          ))}
        </select>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Lưu đơn vị</SubmitButton>
    </form>
  );
}
