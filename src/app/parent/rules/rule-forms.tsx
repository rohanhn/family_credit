"use client";

import { useActionState, useState } from "react";
import { createRuleAction, toggleRuleHiddenAction, updateRuleAction } from "@/app/actions/rules";
import { signed } from "@/lib/time";
import { Field, FormMessage, SubmitButton } from "@/ui/form";
import { Button, Card, Chip } from "@/ui/primitives";

export function NewRuleForm() {
  const [state, action] = useActionState(createRuleAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3" key={state?.message}>
      <h2 className="text-lg font-extrabold">Thêm rule</h2>
      <Field label="Tên hành động" name="name" placeholder="VD: Đánh răng tối" maxLength={60} required />
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[13px] font-extrabold text-muted">
          Loại
          <select name="kind" className="min-h-11 rounded-xl border-2 border-black/15 bg-card px-3 text-base font-bold text-ink">
            <option value="reward">Thưởng (+)</option>
            <option value="penalty">Phạt (−)</option>
          </select>
        </label>
        <div className="w-28">
          <Field label="Số điểm" name="points" type="number" min={1} step={1} inputMode="numeric" required />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Thêm rule</SubmitButton>
    </form>
  );
}

export function RuleRow({ rule }: { rule: { id: number; name: string; kind: "reward" | "penalty"; points: number; hidden: boolean } }) {
  const [editing, setEditing] = useState(false);
  const [saveState, save] = useActionState(updateRuleAction, undefined);
  const [toggleState, toggle] = useActionState(toggleRuleHiddenAction, undefined);
  return (
    <Card className={`flex flex-col gap-3 ${rule.hidden ? "border-2 border-dashed border-black/25 shadow-none" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex flex-1 flex-col">
          <span className="font-extrabold">{rule.name}</span>
          {rule.hidden && <Chip>Đang ẩn</Chip>}
        </span>
        <span className={`font-display text-xl font-extrabold ${rule.kind === "reward" ? "text-plus" : "text-minus"}`}>
          {signed(rule.kind === "reward" ? rule.points : -rule.points)}
        </span>
        <Button variant="outline" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? "Đóng" : "Sửa"}
        </Button>
        <form action={toggle}>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="hidden" value={rule.hidden ? "0" : "1"} />
          <SubmitButton variant="soft">{rule.hidden ? "Hiện lại" : "Ẩn"}</SubmitButton>
        </form>
      </div>
      <FormMessage state={saveState ?? toggleState} />
      {editing && (
        <form action={save} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="ruleId" value={rule.id} />
          <div className="min-w-48 flex-1">
            <Field label="Tên" name="name" defaultValue={rule.name} maxLength={60} required />
          </div>
          <div className="w-28">
            <Field label="Số điểm" name="points" type="number" min={1} step={1} defaultValue={rule.points} required />
          </div>
          <SubmitButton>Lưu</SubmitButton>
          <p className="w-full text-xs font-semibold text-muted">Đổi tên hoặc điểm chỉ áp dụng cho các lần sau; giao dịch cũ giữ nguyên.</p>
        </form>
      )}
    </Card>
  );
}
