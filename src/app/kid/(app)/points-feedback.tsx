"use client";

import { useEffect, useId, useRef } from "react";
import confetti from "canvas-confetti";
import { formatPoints, isRedeem, type FeedbackScreen, type NotificationItem } from "@/lib/notification-screens";
import { formatNotificationTime } from "@/lib/time";
import { ChibiAvatar, Mascot } from "@/ui/chibi";
import { CurrencyIcon } from "@/ui/currency-icon";
import { Icon } from "@/ui/icons";
import { useSound } from "@/ui/sound";
import { THEMES } from "@/ui/themes";
import { usePrefersReducedMotion } from "@/ui/use-reduced-motion";
import type { KidProfile } from "./kid-notifications";

// Màn thông báo điểm mới (mockup KidCelebrate / popup trong WebKidHome; design D6):
// toàn màn hình dưới 768px, popup từ 768px. Đóng màn nào thì đánh dấu đã đọc thông báo của màn đó.

function formatWhen(iso: string, timeZone: string): string {
  return formatNotificationTime(new Date(iso), timeZone);
}

export function PointsFeedback({
  screen,
  profile,
  balance,
  onClose,
}: {
  screen: FeedbackScreen;
  profile: KidProfile;
  balance: number;
  onClose: (ids: number[]) => void;
}) {
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const gift = screen.kind === "gift";

  const { play } = useSound();

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  // Âm thanh vẫn phát khi giảm chuyển động (README §5). Màn từ chối không có âm.
  // Chỉ phát một lần mỗi màn: đối tượng `screen` đổi khi lần hỏi định kỳ trả về dữ liệu mới.
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    if (screen.kind === "penalty") play("penalty");
    if (screen.kind !== "gift") return;
    if (screen.total > 0) play("reward");
    if (!screen.hasRedeem) return;
    // Phát sau âm thưởng; không hủy khi màn đóng (âm phát muộn vô hại).
    setTimeout(() => play("coin"), screen.total > 0 ? 700 : 0);
  }, [screen, play]);

  // Confetti chỉ ở màn ăn mừng và khi không bật giảm chuyển động. Dùng canvas riêng, không dùng worker
  // (worker của canvas-confetti tạo từ blob: sẽ bị CSP chặn).
  useEffect(() => {
    if (!gift || reduced || !canvasRef.current) return;
    const fire = confetti.create(canvasRef.current, { resize: true, useWorker: false, disableForReducedMotion: true });
    fire({ particleCount: 120, spread: 80, origin: { y: 0.35 }, colors: ["#FFC531", "#7EE0C8", "#FF9EC7", "#FFFFFF"] });
    const t = setTimeout(() => fire({ particleCount: 60, spread: 100, origin: { y: 0.3 } }), 450);
    return () => {
      clearTimeout(t);
      fire.reset();
    };
  }, [gift, reduced]);

  const ids = screen.items.map((i) => i.id);
  const close = () => onClose(ids);

  return (
    <div className="fixed inset-0 z-50 flex md:items-start md:justify-center md:overflow-y-auto md:bg-[rgb(15_10_5/0.45)] md:px-4 md:py-[120px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          "relative flex h-full w-full flex-col items-center justify-center-safe gap-4 overflow-y-auto px-6 py-8 text-center",
          "md:h-auto md:max-w-[440px] md:overflow-hidden md:rounded-[32px] md:p-7 md:shadow-press",
          gift ? "bg-primary text-on-primary" : "bg-bg text-ink",
        ].join(" ")}
      >
        {gift && <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true" />}
        {screen.kind === "gift" && <GiftBody screen={screen} profile={profile} titleId={titleId} />}
        {screen.kind === "penalty" && <PenaltyBody screen={screen} profile={profile} balance={balance} titleId={titleId} />}
        {screen.kind === "rejected" && <RejectedBody items={screen.items} profile={profile} titleId={titleId} />}
        <button
          ref={buttonRef}
          type="button"
          onClick={close}
          className={[
            "relative min-h-14 w-full rounded-[20px] px-5 text-lg font-extrabold shadow-press focus-visible:outline-3 focus-visible:outline-offset-2",
            gift ? "bg-white text-primary focus-visible:outline-white" : "bg-primary text-on-primary focus-visible:outline-ink",
          ].join(" ")}
        >
          {screen.kind === "gift" ? "Nhận quà" : screen.kind === "penalty" ? "Con hiểu rồi" : "Con biết rồi"}
        </button>
      </div>
    </div>
  );
}

function GiftBody({ screen, profile, titleId }: { screen: Extract<FeedbackScreen, { kind: "gift" }>; profile: KidProfile; titleId: string }) {
  const mascot = THEMES[profile.theme].mascot;
  return (
    <>
      {mascot && (
        <span className="absolute right-5 top-[120px] rotate-12 md:right-4 md:top-4">
          <Mascot kind={mascot} size={84} onDark />
        </span>
      )}
      <span className="relative md:hidden">
        <ChibiAvatar avatar={profile.avatar} size={160} mood="joy" />
      </span>
      <span className="relative hidden md:block">
        <ChibiAvatar avatar={profile.avatar} size={110} mood="joy" />
      </span>
      {screen.total > 0 ? (
        <span className="relative flex items-center gap-2">
          <CurrencyIcon icon={profile.currencyIcon} size={60} />
          <span className="font-display text-[80px] font-extrabold leading-none md:text-[72px]">{formatPoints(screen.total)}</span>
        </span>
      ) : (
        <span className="relative flex size-20 items-center justify-center rounded-full bg-white/20">
          <Icon name="gift" size={44} />
        </span>
      )}
      <span className="relative flex flex-col gap-1">
        <h2 id={titleId} className="font-display text-[30px] font-extrabold leading-tight md:text-[28px]">
          {screen.total > 0 ? `Giỏi quá, ${profile.name} ơi!` : `${profile.name} nhận quà rồi!`}
        </h2>
        <p className="font-bold">Bố mẹ vừa duyệt cho con</p>
      </span>
      <ul className="relative flex w-full flex-col gap-2 rounded-[22px] bg-black/15 px-4 py-3 text-left">
        {screen.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3 font-extrabold">
            <span className="min-w-0">{i.title}</span>
            <span className="shrink-0">
              {formatPoints(i.amount ?? 0)}
              {isRedeem(i) && <span className="sr-only"> {profile.currencyName} đổi quà</span>}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function PenaltyBody({
  screen,
  profile,
  balance,
  titleId,
}: {
  screen: Extract<FeedbackScreen, { kind: "penalty" }>;
  profile: KidProfile;
  balance: number;
  titleId: string;
}) {
  return (
    <>
      <span className="md:hidden">
        <ChibiAvatar avatar={profile.avatar} size={150} mood="sad" />
      </span>
      <span className="hidden md:block">
        <ChibiAvatar avatar={profile.avatar} size={110} mood="sad" />
      </span>
      <span className="font-display text-[64px] font-extrabold leading-none">
        {formatPoints(-screen.total)} <span className="text-[28px]">{profile.currencyName}</span>
      </span>
      <span className="flex flex-col gap-1">
        <h2 id={titleId} className="font-display text-[28px] font-extrabold leading-tight">
          Ôi, {profile.name} bị trừ {profile.currencyName} rồi
        </h2>
        <p className="font-bold text-muted">Không sao, lần sau mình sửa nhé!</p>
      </span>
      <ul className="flex w-full flex-col gap-3 rounded-[22px] bg-card px-4 py-3 text-left shadow-flat">
        {screen.items.map((i) => {
          const requested = i.requestedAmount ?? i.amount ?? 0;
          const applied = i.amount ?? 0;
          return (
            <li key={i.id} className="flex flex-col gap-0.5">
              <span className="flex justify-between gap-3 font-extrabold">
                <span className="min-w-0">{i.title}</span>
                <span className="shrink-0 text-minus">{formatPoints(requested)}</span>
              </span>
              <span className="text-[13px] font-bold text-muted">
                {i.actorName ?? "Bố mẹ"} · {formatWhen(i.createdAt, profile.timezone)}
              </span>
              {applied !== requested && (
                <span className="text-[13px] font-bold text-muted">
                  Con chỉ còn đủ để trừ {Math.abs(applied)} {profile.currencyName}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <span className="font-extrabold text-muted">
        Con vẫn còn {balance} {profile.currencyName}
      </span>
    </>
  );
}

function RejectedBody({ items, profile, titleId }: { items: NotificationItem[]; profile: KidProfile; titleId: string }) {
  return (
    <>
      <ChibiAvatar avatar={profile.avatar} size={120} />
      <span className="flex flex-col gap-1">
        <h2 id={titleId} className="font-display text-[28px] font-extrabold leading-tight">
          Bố mẹ chưa duyệt
        </h2>
        <p className="font-bold text-muted">Con xem lời nhắn của bố mẹ nhé</p>
      </span>
      <ul className="flex w-full flex-col gap-3 rounded-[22px] bg-card px-4 py-3 text-left shadow-flat">
        {items.map((i) => (
          <li key={i.id} className="flex flex-col gap-0.5">
            <span className="font-extrabold">{i.title}</span>
            {i.reason && <span className="text-sm font-bold text-muted">Bố mẹ nhắn: {i.reason}</span>}
            <span className="text-[13px] font-bold text-muted">
              {i.actorName ?? "Bố mẹ"} · {formatWhen(i.createdAt, profile.timezone)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
