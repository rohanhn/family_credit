"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { kidMarkReadAction, kidUnreadAction, type UnreadPayload } from "@/app/actions/notifications";
import { buildScreens, keepCurrentScreen, nextScreenAfterClose, screenKey, type FeedbackScreen, type NotificationItem } from "@/lib/notification-screens";
import type { ThemeId } from "@/ui/themes";
import { PointsFeedback } from "./points-feedback";

// Trạng thái thông báo chưa đọc của con trong layout khu vực con (design D3/D6):
// màn thông báo điểm mới (task 7.3) và chuông (task 7.6) đọc từ đây.
// Hỏi lại server mỗi 30 giây khi tab đang hiện; tab ẩn thì dừng, hiện lại thì hỏi ngay.

export const POLL_MS = 30_000;

export type KidProfile = {
  name: string;
  avatar: string;
  currencyName: string;
  currencyIcon: string;
  theme: ThemeId;
  timezone: string;
};

type Ctx = {
  count: number;
  balance: number;
  /** Thay trạng thái bằng kết quả mới từ server (bỏ các thông báo vừa đóng mà server chưa kịp ghi). */
  apply: (payload: UnreadPayload) => void;
};

const KidNotificationsContext = createContext<Ctx | null>(null);

export function useKidNotifications(): Ctx {
  const ctx = useContext(KidNotificationsContext);
  if (!ctx) throw new Error("useKidNotifications phải nằm trong KidNotificationsProvider");
  return ctx;
}

export function KidNotificationsProvider({ initial, profile, children }: { initial: UnreadPayload; profile: KidProfile; children: ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>(initial.items);
  const [balance, setBalance] = useState(initial.balance);
  // Màn đang hiện giữ trong state riêng (design D4): thông báo mới chỉ vào hàng đợi phía sau, không thay màn giữa chừng.
  const [current, setCurrent] = useState<FeedbackScreen | null>(() => buildScreens(initial.items)[0] ?? null);
  const dismissed = useRef(new Set<number>());

  const apply = useCallback((payload: UnreadPayload) => {
    const fresh = payload.items.filter((i) => !dismissed.current.has(i.id));
    setItems(fresh);
    setCurrent((c) => keepCurrentScreen(c, fresh));
    setBalance(payload.balance);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const poll = async () => {
      try {
        const payload = await kidUnreadAction();
        if (!stopped) apply(payload);
      } catch {
        // Mất mạng hoặc phiên hết hạn: thử lại ở lần sau; chuyển trang sẽ đưa con về màn đăng nhập.
      }
    };
    const start = () => {
      if (timer === undefined) timer = setInterval(poll, POLL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apply]);

  const close = useCallback(
    // Chỉ đánh dấu đã đọc thông báo của chính màn đang hiện, không dùng danh sách id từ màn gửi lên.
    async () => {
      if (!current) return;
      const ids = current.items.map((i) => i.id);
      for (const id of ids) dismissed.current.add(id);
      const next = nextScreenAfterClose(current, items);
      const remaining = next.items;
      setItems(remaining);
      setCurrent(next.current);
      try {
        await kidMarkReadAction(ids);
      } catch {
        // Mạng lỗi: thông báo vẫn chưa đọc trên server, lần hỏi sau sẽ hiện lại (sau khi tải lại trang).
        for (const id of ids) dismissed.current.delete(id);
      }
      // Số dư và danh sách trên trang có thể đã đổi.
      if (next.current === null) router.refresh();
    },
    [current, items, router],
  );

  const ctx = useMemo<Ctx>(() => ({ count: items.length, balance, apply }), [items.length, balance, apply]);

  return (
    <KidNotificationsContext.Provider value={ctx}>
      {children}
      {current && (
        // Overlay nằm ngoài khung KidShell nên tự đặt data-theme (biến CSS kế thừa qua display: contents).
        <div data-theme={profile.theme} className="contents">
          <PointsFeedback key={screenKey(current)} screen={current} profile={profile} balance={balance} onClose={close} />
        </div>
      )}
    </KidNotificationsContext.Provider>
  );
}
