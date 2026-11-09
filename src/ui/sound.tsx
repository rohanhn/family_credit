"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEVICE_MUTED_KEY, playSfx, shouldPlay, type SfxName } from "./sfx";

// Cài đặt âm thanh phía client: công tắc của gia đình (từ server) và nút loa của thiết bị (localStorage).

type Sound = {
  familyEnabled: boolean;
  deviceMuted: boolean;
  setDeviceMuted: (muted: boolean) => void;
  play: (name: SfxName) => void;
};

const SoundContext = createContext<Sound | null>(null);

const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(DEVICE_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    if (muted) window.localStorage.setItem(DEVICE_MUTED_KEY, "1");
    else window.localStorage.removeItem(DEVICE_MUTED_KEY);
  } catch {
    // localStorage bị chặn: chỉ giữ trong phiên hiện tại qua listeners bên dưới.
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DEVICE_MUTED_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function SoundProvider({ familyEnabled, children }: { familyEnabled: boolean; children: ReactNode }) {
  const deviceMuted = useSyncExternalStore(subscribe, readMuted, () => false);
  const play = useCallback(
    (name: SfxName) => {
      // Đọc lại localStorage để không phát nhầm ngay sau khi vừa tắt loa.
      if (shouldPlay({ familyEnabled, deviceMuted: readMuted() })) playSfx(name);
    },
    [familyEnabled],
  );
  const value = useMemo<Sound>(() => ({ familyEnabled, deviceMuted, setDeviceMuted: writeMuted, play }), [familyEnabled, deviceMuted, play]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** Ngoài SoundProvider thì không phát gì. */
export function useSound(): Sound {
  return (
    useContext(SoundContext) ?? {
      familyEnabled: false,
      deviceMuted: false,
      setDeviceMuted: () => {},
      play: () => {},
    }
  );
}
