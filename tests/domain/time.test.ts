import { describe, expect, it } from "vitest";
import { addDays, dateInZone, signed, startOfDayInZone, weekdayIndex } from "@/lib/time";

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
