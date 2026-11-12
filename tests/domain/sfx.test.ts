import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFamily, setFamilySound } from "@/server/domain/families";
import { SFX, sfxAudibleDuration, sfxDuration, shouldPlay, type SfxDef } from "@/ui/sfx";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

// Task 7.5: hàm quyết định có phát âm thanh hay không (spec ui-theme "Âm thanh phản hồi").

describe("shouldPlay", () => {
  it("Gia đình tắt: không phát dù thiết bị bật", () => {
    expect(shouldPlay({ familyEnabled: false, deviceMuted: false })).toBe(false);
  });

  it("Thiết bị tắt loa: không phát dù gia đình bật", () => {
    expect(shouldPlay({ familyEnabled: true, deviceMuted: true })).toBe(false);
  });

  it("Cả hai đều tắt: không phát", () => {
    expect(shouldPlay({ familyEnabled: false, deviceMuted: true })).toBe(false);
  });

  it("Cả hai bật: phát", () => {
    expect(shouldPlay({ familyEnabled: true, deviceMuted: false })).toBe(true);
  });
});

describe("Thông số âm (README §5)", () => {
  it("Có đủ 4 âm, âm lượng đỉnh nhỏ và âm phạt trầm hơn âm thưởng", () => {
    expect(Object.keys(SFX).sort()).toEqual(["coin", "penalty", "pop", "reward"]);
    for (const s of Object.values(SFX)) expect(s.gain).toBeLessThanOrEqual(0.2);
    const maxFreq = (name: keyof typeof SFX) => Math.max(...SFX[name].notes.map((n) => n[0]));
    expect(maxFreq("penalty")).toBeLessThan(maxFreq("reward"));
    expect(SFX.penalty.type).toBe("sine");
  });
});

describe("Đo âm: tổng độ dài và thời gian nghe rõ (change lengthen-sound-effects, design D3)", () => {
  // Kết quả tính tay với đường bao: tăng 15 ms, giữ đỉnh tới 60% nốt, giảm hàm mũ về 0,0001; ngưỡng −30 dBFS = 0,03162.
  // Đỉnh 0,1: đoạn tăng chạm ngưỡng sau 15 ms × ln(316,2)/ln(1000) = 12,5 ms;
  // đoạn giảm (400 ms) rơi dưới ngưỡng sau 400 ms × ln(3,162)/ln(1000) = 66,7 ms.
  const one: SfxDef = { type: "sine", gain: 0.1, notes: [[440, 0, 1]] };
  const two: SfxDef = { type: "sine", gain: 0.1, notes: [[440, 0, 1], [660, 0.5, 1]] };

  it("Một nốt: dài 1 giây, nghe rõ từ 12,5 ms tới 666,7 ms", () => {
    expect(sfxDuration(one)).toBe(1);
    expect(sfxAudibleDuration(one)).toBeCloseTo(0.6667 - 0.0125, 3);
  });

  it("Hai nốt chồng nhau: phần chồng chỉ tính một lần", () => {
    // Nốt hai nghe rõ từ 512,5 ms tới 1166,7 ms, nối liền với nốt một.
    expect(sfxDuration(two)).toBe(1.5);
    expect(sfxAudibleDuration(two)).toBeCloseTo(1.1667 - 0.0125, 3);
  });

  it("Hai nốt rời nhau: cộng từng khoảng", () => {
    const apart: SfxDef = { type: "sine", gain: 0.1, notes: [[440, 0, 1], [660, 2, 1]] };
    expect(sfxAudibleDuration(apart)).toBeCloseTo(2 * (0.6667 - 0.0125), 3);
  });

  it("Đỉnh dưới ngưỡng: không có khoảng nghe rõ", () => {
    expect(sfxAudibleDuration({ type: "sine", gain: 0.02, notes: [[440, 0, 1]] })).toBe(0);
  });
});

describe("spec ui-theme: Bố mẹ tắt âm thanh cả gia đình", () => {
  let t: TestDb;
  beforeEach(async () => {
    t = await createTestDb();
  });
  afterEach(async () => {
    await t.close();
  });

  it("Mặc định bật; tắt rồi bật lại được; không đụng tới gia đình khác", async () => {
    const a = await seedFamily(t.db, { familyName: "Nhà A" });
    const b = await seedFamily(t.db, { familyName: "Nhà B" });
    expect((await getFamily(t.db, a.family.id)).soundEnabled).toBe(true);
    expect(await setFamilySound(t.db, a.family.id, false)).toBe(false);
    expect((await getFamily(t.db, a.family.id)).soundEnabled).toBe(false);
    expect((await getFamily(t.db, b.family.id)).soundEnabled).toBe(true);
    expect(await setFamilySound(t.db, a.family.id, true)).toBe(true);
  });
});
