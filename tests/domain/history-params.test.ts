import { describe, expect, it } from "vitest";
import { historyPagerParams, historyQuery, parseHistoryParams } from "@/ui/history-list";

// Chuẩn hóa tham số lọc lịch sử (task 2.1, design D3 của change polish-after-mvp).

describe("parseHistoryParams", () => {
  it("Nhận tham số hợp lệ", () => {
    expect(parseHistoryParams({ child: "7", kind: "redeem", from: "2026-11-01", to: "2026-11-07", before: "120" }, { childIds: [7, 8] })).toEqual({
      childId: 7,
      kind: "redeem",
      from: "2026-11-01",
      to: "2026-11-07",
      before: 120,
    });
  });

  it("Loại sai bị bỏ qua", () => {
    expect(parseHistoryParams({ kind: "hack" }).kind).toBeUndefined();
    expect(parseHistoryParams({ kind: "" }).kind).toBeUndefined();
  });

  it("Ngày sai bị bỏ qua", () => {
    const p = parseHistoryParams({ from: "2026-13-01", to: "hôm qua" });
    expect(p.from).toBe("");
    expect(p.to).toBe("");
  });

  it("from sau to thì đổi chỗ", () => {
    const p = parseHistoryParams({ from: "2026-11-07", to: "2026-11-01" });
    expect([p.from, p.to]).toEqual(["2026-11-01", "2026-11-07"]);
  });

  it("before sai bị bỏ qua", () => {
    for (const before of ["0", "-1", "abc", "1.5", "12345678901"]) expect(parseHistoryParams({ before }).before).toBeUndefined();
  });

  it("child chỉ nhận khi thuộc danh sách con; không truyền danh sách thì luôn bỏ qua", () => {
    expect(parseHistoryParams({ child: "9" }, { childIds: [7, 8] }).childId).toBeUndefined();
    expect(parseHistoryParams({ child: "7" }).childId).toBeUndefined();
  });
});

describe("historyQuery và historyPagerParams", () => {
  it("Khoảng ngày theo múi giờ gia đình, đến hết ngày `to`", () => {
    const q = historyQuery(parseHistoryParams({ kind: "task", from: "2026-11-01", to: "2026-11-07" }), "Asia/Ho_Chi_Minh");
    expect(q.kinds).toEqual(["task"]);
    expect(q.from?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(q.to?.toISOString()).toBe("2026-11-07T17:00:00.000Z");
  });

  it("Link phân trang giữ bộ lọc, không mang theo before", () => {
    const p = parseHistoryParams({ child: "7", kind: "redeem", from: "2026-11-01", before: "50" }, { childIds: [7] });
    expect(historyPagerParams(p)).toEqual({ child: "7", kind: "redeem", from: "2026-11-01", to: "" });
  });
});
