"use client";

import { useEffect, useId, useRef, useState } from "react";
import { kidNotificationListAction } from "@/app/actions/notifications";
import { formatPoints, type NotificationItem } from "@/lib/notification-screens";
import { formatNotificationTime } from "@/lib/time";
import { Icon, type IconName } from "@/ui/icons";
import { ICON_BUTTON_CLASS } from "@/ui/kid-shell";
import { useKidNotifications } from "./kid-notifications";

// Chuông thông báo của con (spec kid-notifications "Chuông thông báo của con"; task 7.6):
// số chưa đọc, mở ra là danh sách 30 ngày gần nhất, mới nhất trước.

const KIND: Record<NotificationItem["kind"], { label: string; icon: IconName; tone: string }> = {
  gift: { label: "Nhận quà", icon: "gift", tone: "bg-done-bg text-done-fg" },
  penalty: { label: "Bị trừ điểm", icon: "minus", tone: "bg-penalty-bg text-penalty-on" },
  rejected: { label: "Bị từ chối", icon: "info", tone: "bg-wait-bg text-wait-fg" },
};

export function NotificationBell({ variant, currencyName, timezone }: { variant: "icon" | "sidebar"; currencyName: string; timezone: string }) {
  const { count } = useKidNotifications();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => setOpen(!open);

  // Mở danh sách thì tải; đang mở mà số chưa đọc đổi (lần hỏi định kỳ, hoặc vừa đóng màn điểm mới) thì tải lại.
  useEffect(() => {
    if (!open) return;
    let live = true;
    kidNotificationListAction().then(
      (items) => {
        if (!live) return;
        setList(items);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [open, count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const label = count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo";
  const badge = count > 0 && (
    <span
      aria-hidden="true"
      className="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-minus px-1.5 text-xs font-extrabold leading-none text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );

  return (
    <div ref={wrapRef} className="relative">
      {variant === "icon" ? (
        <button ref={buttonRef} type="button" onClick={toggle} aria-label={label} aria-expanded={open} aria-controls={panelId} className={`relative ${ICON_BUTTON_CLASS}`}>
          <Icon name="bell" />
          {badge}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          aria-label={label}
          aria-expanded={open}
          aria-controls={panelId}
          className="relative flex min-h-12 w-full items-center gap-2.5 rounded-[14px] bg-bg px-3.5 text-[15px] font-extrabold text-ink focus-visible:outline-3 focus-visible:outline-ink"
        >
          <Icon name="bell" size={20} />
          Thông báo
          {count > 0 && (
            <span aria-hidden="true" className="ml-auto flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-minus px-1.5 text-xs font-extrabold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Thông báo 30 ngày gần nhất"
          className={[
            "z-40 flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-3xl bg-card text-ink shadow-[0_8px_30px_rgb(0_0_0/0.18)]",
            variant === "icon" ? "fixed inset-x-4 top-[84px]" : "absolute left-0 top-full mt-2 w-[360px]",
          ].join(" ")}
        >
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <h2 className="font-display text-xl font-extrabold">Thông báo</h2>
            <span className="text-sm font-bold text-muted">30 ngày gần nhất</span>
          </div>
          <div className="overflow-y-auto">
            {failed ? (
              <p className="p-4 font-bold text-muted">Chưa tải được thông báo, con thử lại nhé.</p>
            ) : list === null ? (
              <p className="p-4 font-bold text-muted">Đang tải…</p>
            ) : list.length === 0 ? (
              <p className="p-4 font-bold text-muted">Chưa có thông báo nào.</p>
            ) : (
              <ul className="flex flex-col">
                {list.map((n) => {
                  const k = KIND[n.kind];
                  // Bị trừ điểm: hiện mức thực trừ (amount), không hiện mức gốc (spec "Phạt vượt số dư trong chuông").
                  const shown = n.amount;
                  return (
                    <li key={n.id} className={`flex gap-3 border-b border-black/5 px-4 py-3 last:border-0 ${n.read ? "" : "bg-soft/50"}`}>
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${k.tone}`}>
                        <Icon name={k.icon} size={20} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 font-extrabold">{n.title}</span>
                          {shown !== null && shown !== undefined && (
                            <span className={`shrink-0 font-display text-lg font-extrabold ${shown >= 0 ? "text-done-fg" : "text-minus"}`}>
                              {formatPoints(shown)}
                              <span className="sr-only"> {currencyName}</span>
                            </span>
                          )}
                        </span>
                        {n.reason && <span className="text-sm font-bold text-muted">Lý do: {n.reason}</span>}
                        <span className="text-xs font-bold text-muted">
                          {k.label} · {formatNotificationTime(new Date(n.createdAt), timezone)}
                          {!n.read && <span className="font-extrabold text-ink"> · Mới</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
