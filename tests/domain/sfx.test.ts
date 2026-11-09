import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getFamily, setFamilySound } from "@/server/domain/families";
import { SFX, shouldPlay } from "@/ui/sfx";
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
