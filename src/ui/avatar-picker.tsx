import { AVATAR_IDS } from "@/lib/avatars";
import { ChibiAvatar } from "./chibi";

/** Chọn avatar từ bộ có sẵn bằng radio thật (dùng được bằng bàn phím). */
export function AvatarPicker({ name = "avatar", defaultValue, idPrefix }: { name?: string; defaultValue?: string; idPrefix: string }) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[13px] font-extrabold text-muted">Avatar</legend>
      <div className="flex flex-wrap gap-2">
        {AVATAR_IDS.map((id, i) => (
          <label key={id} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={id}
              id={`${idPrefix}-${id}`}
              defaultChecked={defaultValue ? defaultValue === id : i === 0}
              className="peer sr-only"
            />
            <span className="sr-only">Avatar {i + 1}</span>
            <span className="flex size-14 items-center justify-center rounded-2xl border-3 border-transparent bg-soft peer-checked:border-primary peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
              <ChibiAvatar avatar={id} size={44} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
