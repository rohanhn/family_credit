import { describe, expect, it } from "vitest";
import { progressPercent } from "@/lib/progress";
import { goalProgress } from "@/server/domain/shop";

// Design D6: thanh tiến độ và phần trăm hiển thị dùng chung một cách làm tròn (xuống).

describe("progressPercent", () => {
  it("199/200 → 99%, không làm tròn lên 100%", () => {
    expect(progressPercent(199, 200)).toBe(99);
    expect(goalProgress(199, 200).percent).toBe(99);
  });

  it("Giới hạn 0–100 và max ≤ 0 thì là 0", () => {
    expect(progressPercent(250, 200)).toBe(100);
    expect(progressPercent(-5, 200)).toBe(0);
    expect(progressPercent(5, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(33);
  });
});
