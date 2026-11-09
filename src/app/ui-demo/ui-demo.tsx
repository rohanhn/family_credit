"use client";

import { useState } from "react";
import { Mascot } from "@/ui/chibi";
import { Icon } from "@/ui/icons";
import { ICON_BUTTON_CLASS, KidShell } from "@/ui/kid-shell";
import { ParentColumns, ParentShell } from "@/ui/parent-shell";
import { Button, Card, Chip, CoinIcon, ProgressBar } from "@/ui/primitives";
import { THEME_IDS, THEMES, type ThemeId } from "@/ui/themes";

export function UiDemo() {
  const [theme, setTheme] = useState<ThemeId>("sunny");
  const [area, setArea] = useState<"kid" | "parent">("kid");
  const mascot = THEMES[theme].mascot;

  const switcher = (
    <Card className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-extrabold text-muted">Theme:</span>
      {THEME_IDS.map((id) => (
        <Button key={id} size="md" variant={id === theme ? "primary" : "soft"} aria-pressed={id === theme} onClick={() => setTheme(id)}>
          {THEMES[id].name}
        </Button>
      ))}
      <Button variant="outline" onClick={() => setArea(area === "kid" ? "parent" : "kid")}>
        {area === "kid" ? "Xem khu vực bố mẹ" : "Xem khu vực con"}
      </Button>
    </Card>
  );

  if (area === "parent") {
    return (
      <ParentShell theme={theme} familyName="Nhà Bin & Na" actions={<Button>Bật chế độ gia đình</Button>}>
        {switcher}
        <ParentColumns
          main={
            <>
              <h1 className="font-display text-3xl font-extrabold">Chờ duyệt</h1>
              <Card className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
                  <Chip>Nhiệm vụ</Chip>
                  <span className="text-[17px] font-extrabold">
                    Na · Làm bài tập <span className="text-plus">+15</span>
                  </span>
                </div>
                <Button variant="outline">Từ chối</Button>
                <Button>Duyệt</Button>
              </Card>
            </>
          }
          aside={
            <>
              <h2 className="font-display text-2xl font-extrabold">Gần đây</h2>
              <Card className="flex justify-between font-extrabold">
                <span>Su · Nói trống không</span>
                <span className="text-minus">−3</span>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="reward">+ Thưởng</Button>
                <Button variant="penalty">− Phạt</Button>
              </div>
            </>
          }
        />
      </ParentShell>
    );
  }

  return (
    <KidShell
      theme={theme}
      childName="Bin"
      avatar="boy-brown"
      familyName="Nhà Bin & Na"
      subtitle="Thứ Hai, 9/11"
      actions={
        <button type="button" aria-label="Tắt âm thanh" className={ICON_BUTTON_CLASS}>
          <Icon name="speaker" />
        </button>
      }
      sidebarActions={
        <Button variant="outline">
          <Icon name="logout" size={20} />
          Thoát
        </Button>
      }
    >
      {switcher}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="relative flex min-h-36 items-center gap-4 overflow-hidden rounded-[28px] bg-primary px-6 py-5 text-on-primary">
          <CoinIcon size={64} />
          <span className="flex flex-col">
            <span className="font-bold opacity-90">Con đang có</span>
            <span className="font-display text-[52px] font-extrabold leading-none">
              120 <span className="text-2xl">Sao</span>
            </span>
          </span>
          {mascot && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <Mascot kind={mascot} onDark />
            </span>
          )}
        </div>
        <Card className="flex flex-col justify-center gap-2.5">
          <span className="text-xs font-extrabold text-muted">MỤC TIÊU CỦA CON</span>
          <span className="text-lg font-extrabold">Đi công viên</span>
          <ProgressBar value={120} max={200} label="Tiến độ mục tiêu Đi công viên" />
          <span className="text-sm font-bold text-muted">120 / 200 Sao · Còn 80 nữa</span>
        </Card>
      </div>
      <h2 className="font-display text-[22px] font-extrabold">Nhiệm vụ hôm nay</h2>
      <div className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        <Card className="flex items-center gap-3">
          <span className="flex flex-1 flex-col">
            <span className="font-extrabold">Đánh răng buổi sáng</span>
            <span className="text-sm font-bold text-muted">+5 Sao</span>
          </span>
          <Chip tone="done">
            <Icon name="check" size={14} /> Xong
          </Chip>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex flex-1 flex-col gap-1">
            <Chip>Nhiệm vụ nhóm · Bin, Na, Su</Chip>
            <span className="font-extrabold">Dọn phòng chơi</span>
            <span className="text-sm font-bold text-muted">+20 Sao · Na đã báo xong</span>
          </span>
          <Chip tone="wait">Chờ duyệt</Chip>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="flex flex-1 flex-col">
            <span className="font-extrabold">Làm bài tập</span>
            <span className="text-sm font-bold text-muted">+15 Sao</span>
          </span>
          <Button>Con xong rồi</Button>
        </Card>
      </div>
    </KidShell>
  );
}
