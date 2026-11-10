"use client";

import { useActionState, useState } from "react";
import { createRewardAction, toggleRewardHiddenAction, updateRewardAction } from "@/app/actions/shop";
import { REWARD_ICONS, rewardIcon, type RewardIcon } from "@/lib/reward-icons";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Icon } from "@/ui/icons";
import { Button, Card, Chip } from "@/ui/primitives";

const ICON_LABELS: Record<RewardIcon, string> = {
  gift: "Quà",
  game: "Trò chơi",
  icecream: "Kem",
  park: "Đi chơi",
  blocks: "Đồ chơi",
  book: "Sách",
  movie: "Phim",
};

/** Chọn icon từ bộ có sẵn (radio, mỗi ô 44×44). */
function IconPicker({ defaultValue = "gift" }: { defaultValue?: string }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[13px] font-extrabold text-muted">Icon</legend>
      <div className="flex flex-wrap gap-1.5">
        {REWARD_ICONS.map((icon) => (
          <label key={icon} title={ICON_LABELS[icon]} className="cursor-pointer">
            <input type="radio" name="icon" value={icon} defaultChecked={icon === defaultValue} className="peer sr-only" />
            <span className="flex size-11 items-center justify-center rounded-[14px] border-2 border-transparent bg-soft text-ink peer-checked:border-primary peer-checked:bg-card peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
              <Icon name={icon} />
              <span className="sr-only">{ICON_LABELS[icon]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NewRewardForm() {
  const [state, action] = useActionState(createRewardAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3" key={state?.message}>
      <h2 className="text-lg font-extrabold">Thêm phần thưởng</h2>
      <Field label="Tên phần thưởng" name="name" placeholder="VD: 30 phút chơi game" maxLength={60} required />
      <div className="w-32">
        <Field label="Giá" name="price" type="number" min={1} step={1} inputMode="numeric" required />
      </div>
      <Field label="Mô tả (không bắt buộc)" name="description" maxLength={200} />
      <IconPicker />
      <FormMessage state={state} />
      <SubmitButton>Thêm phần thưởng</SubmitButton>
    </form>
  );
}

export type RewardRowData = { id: number; name: string; price: number; icon: string; description: string | null; hidden: boolean; goalOf: string[] };

export function RewardRow({ reward, currencyName }: { reward: RewardRowData; currencyName: string }) {
  const [editing, setEditing] = useState(false);
  const [saveState, save] = useActionState(updateRewardAction, undefined);
  const [toggleState, toggle] = useActionState(toggleRewardHiddenAction, undefined);
  const icon = rewardIcon(reward.icon);
  return (
    <Card className={`flex flex-col gap-3 ${reward.hidden ? "border-2 border-dashed border-black/25 shadow-none" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-soft text-primary">
          <Icon name={icon} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-extrabold">{reward.name}</span>
          {reward.description && <span className="text-sm font-semibold text-muted">{reward.description}</span>}
          <span className="flex flex-wrap gap-1">
            {reward.hidden && <Chip>Đang ẩn</Chip>}
            {reward.goalOf.length > 0 && <Chip tone="primary">Mục tiêu của {reward.goalOf.join(", ")}</Chip>}
          </span>
        </span>
        <span className="font-display text-xl font-extrabold">
          {reward.price} {currencyName}
        </span>
        <Button variant="outline" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? "Đóng" : "Sửa"}
        </Button>
        <form action={toggle}>
          <input type="hidden" name="rewardId" value={reward.id} />
          <input type="hidden" name="hidden" value={reward.hidden ? "0" : "1"} />
          <SubmitButton variant="soft">{reward.hidden ? "Hiện lại" : "Ẩn"}</SubmitButton>
        </form>
      </div>
      <FormMessage state={saveState ?? toggleState} />
      {editing && (
        <form action={save} className="flex flex-col gap-3">
          <input type="hidden" name="rewardId" value={reward.id} />
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Field label="Tên" name="name" defaultValue={reward.name} maxLength={60} required />
            </div>
            <div className="w-28">
              <Field label="Giá" name="price" type="number" min={1} step={1} defaultValue={reward.price} required />
            </div>
          </div>
          <Field label="Mô tả (không bắt buộc)" name="description" defaultValue={reward.description ?? ""} maxLength={200} />
          <IconPicker defaultValue={icon} />
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>Lưu</SubmitButton>
            <p className="text-xs font-semibold text-muted">Đổi giá chỉ áp dụng cho yêu cầu gửi sau; yêu cầu đang chờ và đã duyệt giữ giá cũ.</p>
          </div>
        </form>
      )}
      {!reward.hidden && reward.goalOf.length > 0 && !editing && (
        <p className="text-xs font-semibold text-muted">Ẩn phần thưởng này sẽ bỏ mục tiêu của {reward.goalOf.join(", ")}.</p>
      )}
    </Card>
  );
}
