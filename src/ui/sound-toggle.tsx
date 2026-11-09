"use client";

import { Icon } from "./icons";
import { ICON_BUTTON_CLASS } from "./kid-shell";
import { useSound } from "./sound";

// Nút loa của thiết bị (README §5): icon ở header điện thoại, nút có chữ trong sidebar.
// Bật lại thì phát âm "pop" để con nghe thử.

export function SoundToggle({ variant }: { variant: "icon" | "sidebar" }) {
  const { familyEnabled, deviceMuted, setDeviceMuted, play } = useSound();
  if (!familyEnabled) {
    return variant === "sidebar" ? <p className="px-1 text-sm font-bold text-muted">Bố mẹ đã tắt âm thanh</p> : null;
  }
  const toggle = () => {
    const next = !deviceMuted;
    setDeviceMuted(next);
    if (!next) play("pop");
  };
  const label = deviceMuted ? "Bật âm thanh" : "Tắt âm thanh";
  if (variant === "icon") {
    return (
      <button type="button" onClick={toggle} aria-label={label} aria-pressed={deviceMuted} className={ICON_BUTTON_CLASS}>
        <Icon name={deviceMuted ? "speakerOff" : "speaker"} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={deviceMuted}
      className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-bg px-3.5 text-[15px] font-extrabold text-ink focus-visible:outline-3 focus-visible:outline-ink"
    >
      <Icon name={deviceMuted ? "speakerOff" : "speaker"} size={20} />
      {deviceMuted ? "Âm thanh đang tắt" : "Âm thanh đang bật"}
    </button>
  );
}
