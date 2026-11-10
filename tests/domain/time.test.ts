import { describe, expect, it } from "vitest";
import { addDays, dateInZone, formatInstantDate, formatNotificationTime, signed, startOfDayInZone, weekdayIndex } from "@/lib/time";

describe("ngày theo múi giờ gia đình", () => {
  const VN = "Asia/Ho_Chi_Minh";

  it("dateInZone theo múi giờ, không theo UTC", () => {
    expect(dateInZone(new Date("2026-11-09T16:59:59Z"), VN)).toBe("2026-11-09");
    expect(dateInZone(new Date("2026-11-09T17:00:00Z"), VN)).toBe("2026-11-10");
  });

  it("startOfDayInZone: 00:00 giờ Việt Nam là 17:00 UTC hôm trước", () => {
    expect(startOfDayInZone("2026-11-10", VN).toISOString()).toBe("2026-11-09T17:00:00.000Z");
    expect(startOfDayInZone("2026-03-30", "Europe/Berlin").toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("addDays, weekdayIndex (thứ Hai = 0)", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayIndex("2026-11-09")).toBe(0); // thứ Hai
    expect(weekdayIndex("2026-11-15")).toBe(6); // Chủ nhật
  });

  it("signed", () => {
    expect([signed(5), signed(-5), signed(0)]).toEqual(["+5", "−5", "0"]);
  });
});

describe("giờ thông báo theo múi giờ gia đình", () => {
  // 20:00 giờ Việt Nam ngày 9/11 = 13:00 UTC. Kết quả không phụ thuộc múi giờ của máy chạy test.
  const at = new Date("2026-11-09T13:00:00Z");

  it("Cùng ngày theo múi giờ gia đình: hôm nay 20:00", () => {
    expect(formatNotificationTime(at, "Asia/Ho_Chi_Minh", new Date("2026-11-09T16:00:00Z"))).toBe("hôm nay 20:00");
  });

  it("Ngày khác: kèm ngày/tháng theo múi giờ gia đình", () => {
    expect(formatNotificationTime(at, "Asia/Ho_Chi_Minh", new Date("2026-11-10T03:00:00Z"))).toBe("9/11 20:00");
    // Cùng thời điểm, xem theo múi giờ New York thì là 08:00.
    expect(formatNotificationTime(at, "America/New_York", new Date("2026-11-11T03:00:00Z"))).toBe("9/11 08:00");
  });
});

describe("ngày của một thời điểm theo múi giờ gia đình (task 4.2 change polish-after-mvp)", () => {
  it("Không phụ thuộc múi giờ của máy chạy", () => {
    // 01:30 ngày 10/11 ở Việt Nam, vẫn là ngày 09/11 ở Los Angeles và UTC.
    const instant = new Date("2026-11-09T18:30:00Z");
    expect(formatInstantDate(instant, "Asia/Ho_Chi_Minh")).toBe("10/11/2026");
    expect(formatInstantDate(instant, "America/Los_Angeles")).toBe("09/11/2026");
    expect(formatInstantDate(instant, "UTC")).toBe("09/11/2026");
  });
});
