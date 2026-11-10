import { describe, expect, it } from "vitest";
import { buildScreens, formatPoints, keepCurrentScreen, nextScreenAfterClose, screenKey, type NotificationItem } from "@/lib/notification-screens";

// Task 7.3: nhóm thông báo theo loại và thứ tự hiển thị (spec ui-theme, kid-notifications).

let nextId = 1;
function n(kind: NotificationItem["kind"], title: string, amount: number | null, extra: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: nextId++,
    kind,
    title,
    amount,
    requestedAmount: amount,
    reason: null,
    actorName: "Bố",
    refType: null,
    createdAt: "2026-11-09T09:00:00.000Z",
    ...extra,
  };
}

describe("buildScreens", () => {
  it("Không có thông báo thì không có màn nào", () => {
    expect(buildScreens([])).toEqual([]);
  });

  it("Đăng nhập khi có quà: hai khoản +15 và +5 gộp một màn, tổng +20", () => {
    const screens = buildScreens([n("gift", "Làm bài tập", 15), n("gift", "Tự dọn đồ chơi", 5)]);
    expect(screens).toHaveLength(1);
    expect(screens[0]).toMatchObject({ kind: "gift", total: 20, hasRedeem: false });
    expect(screens[0].items.map((i) => i.title)).toEqual(["Làm bài tập", "Tự dọn đồ chơi"]);
  });

  it("Vừa được cộng vừa bị trừ: cộng trước, trừ sau, từ chối cuối cùng", () => {
    const rejected = n("rejected", "Đánh răng", null, { reason: "Chưa thấy" });
    const penalty = n("penalty", "Nói dối", -10);
    const gift = n("gift", "Làm bài tập", 15);
    // Thứ tự đầu vào lộn xộn, thứ tự thời gian theo id.
    const screens = buildScreens([rejected, penalty, gift]);
    expect(screens.map((s) => s.kind)).toEqual(["gift", "penalty", "rejected"]);
  });

  it("Trong mỗi màn, khoản cũ nhất trước", () => {
    const a = n("gift", "A", 1);
    const b = n("gift", "B", 2);
    expect(buildScreens([b, a])[0].items.map((i) => i.title)).toEqual(["A", "B"]);
  });

  it("Phạt khi số dư 0: màn trừ hiện mức gốc, mức thực trừ là 0", () => {
    const [screen] = buildScreens([n("penalty", "Nói dối", 0, { requestedAmount: -10 })]);
    expect(screen).toMatchObject({ kind: "penalty", total: 10, applied: 0 });
  });

  it("Phạt vượt số dư: tổng gốc và tổng thực trừ khác nhau", () => {
    const [screen] = buildScreens([n("penalty", "Nói dối", -3, { requestedAmount: -10 }), n("penalty", "Đánh nhau", -5)]);
    expect(screen).toMatchObject({ total: 15, applied: 8 });
  });

  it("Đổi thưởng được duyệt nằm ở màn nhận quà nhưng không cộng vào tổng điểm", () => {
    const [screen] = buildScreens([
      n("gift", "Bố mẹ đã duyệt: 30 phút chơi game", -50, { refType: "redemption" }),
      n("gift", "Làm bài tập", 15),
    ]);
    expect(screen).toMatchObject({ kind: "gift", total: 15, hasRedeem: true });
    expect(screen.items).toHaveLength(2);
  });

  it("Chỉ có thông báo bị từ chối: một màn từ chối, không có màn ăn mừng", () => {
    const screens = buildScreens([n("rejected", "Đổi quà", null, { reason: "Hôm nay muộn rồi" })]);
    expect(screens.map((s) => s.kind)).toEqual(["rejected"]);
  });
});

describe("formatPoints", () => {
  it("Dùng dấu + và dấu trừ thật", () => {
    expect(formatPoints(15)).toBe("+15");
    expect(formatPoints(-10)).toBe("−10");
    expect(formatPoints(0)).toBe("0");
  });
});

describe("Hàng đợi màn phản hồi (design D4)", () => {
  it("Có quà mới khi đang xem màn bị trừ: màn bị trừ giữ nguyên, đóng xong mới tới màn quà", () => {
    const penalty = n("penalty", "Nói dối", -10);
    let items = [penalty];
    let current = keepCurrentScreen(null, items);
    expect(current?.kind).toBe("penalty");
    const key = screenKey(current!);

    // Lượt hỏi định kỳ trả về thêm một quà (màn quà đứng trước màn trừ theo thứ tự).
    const gift = n("gift", "Đọc sách", 5);
    items = [penalty, gift];
    current = keepCurrentScreen(current, items);
    expect(current?.kind).toBe("penalty");
    expect(screenKey(current!)).toBe(key);

    const next = nextScreenAfterClose(current!, items);
    expect(next.items.map((i) => i.id)).toEqual([gift.id]);
    expect(next.current?.kind).toBe("gift");
    expect(screenKey(next.current!)).not.toBe(key);
  });

  it("Thông báo cùng loại đến sau không gộp vào màn đang hiện; hiện ở màn kế tiếp", () => {
    const first = n("gift", "Một", 5);
    const current = keepCurrentScreen(null, [first]);
    const later = n("gift", "Hai", 3);
    const same = keepCurrentScreen(current, [first, later]);
    expect(same).toBe(current);
    expect(same?.items.map((i) => i.title)).toEqual(["Một"]);
    const next = nextScreenAfterClose(same!, [first, later]);
    expect(next.current?.items.map((i) => i.title)).toEqual(["Hai"]);
  });

  it("Đóng màn cuối thì không còn màn nào", () => {
    const only = n("rejected", "Kem", null);
    const current = keepCurrentScreen(null, [only]);
    expect(nextScreenAfterClose(current!, [only])).toEqual({ items: [], current: null });
  });
});
