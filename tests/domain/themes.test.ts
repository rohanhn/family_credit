import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getEffectiveTheme, setChildTheme, setFamilyTheme } from "@/server/domain/themes";
import { effectiveTheme } from "@/ui/themes";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

describe("Thứ tự ưu tiên theme (design D6)", () => {
  it("Theme của con được ưu tiên hơn theme gia đình", () => {
    expect(effectiveTheme("robot", "ocean")).toBe("robot");
  });

  it("Con chưa chọn thì dùng theme gia đình", () => {
    expect(effectiveTheme(null, "ocean")).toBe("ocean");
  });

  it("Giá trị lạ bị bỏ qua, cuối cùng về sunny", () => {
    expect(effectiveTheme("khong-co", "candy")).toBe("candy");
    expect(effectiveTheme(undefined, "khong-co")).toBe("sunny");
  });
});

describe("spec ui-theme: Theme mặc định của gia đình", () => {
  it("Đổi theme mặc định: màn bố mẹ và con chưa tự chọn đổi theo, con đã chọn giữ nguyên", async () => {
    const { family, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
    await setChildTheme(t.db, family.id, kids[1].id, "magic");
    await setFamilyTheme(t.db, family.id, "ocean");
    expect(await getEffectiveTheme(t.db, family.id)).toBe("ocean");
    expect(await getEffectiveTheme(t.db, family.id, kids[0].id)).toBe("ocean");
    expect(await getEffectiveTheme(t.db, family.id, kids[1].id)).toBe("magic");
  });

  it("Theme không có trong danh sách bị từ chối", async () => {
    const { family } = await seedFamily(t.db);
    await expect(setFamilyTheme(t.db, family.id, "neon")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("spec ui-theme: Con tự chọn theme", () => {
  it("Con chọn theme: chỉ màn của con đổi, lựa chọn được lưu", async () => {
    const { family, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
    await setChildTheme(t.db, family.id, kids[0].id, "robot");
    expect(await getEffectiveTheme(t.db, family.id, kids[0].id)).toBe("robot");
    expect(await getEffectiveTheme(t.db, family.id, kids[1].id)).toBe("sunny");
    expect(await getEffectiveTheme(t.db, family.id)).toBe("sunny");
  });

  it("Về theme gia đình", async () => {
    const { family, kids } = await seedFamily(t.db);
    await setFamilyTheme(t.db, family.id, "candy");
    await setChildTheme(t.db, family.id, kids[0].id, "robot");
    await setChildTheme(t.db, family.id, kids[0].id, null);
    expect(await getEffectiveTheme(t.db, family.id, kids[0].id)).toBe("candy");
  });

  it("Không đổi được theme của con nhà khác", async () => {
    const a = await seedFamily(t.db, { familyName: "Nhà A" });
    const b = await seedFamily(t.db, { familyName: "Nhà B" });
    await expect(setChildTheme(t.db, b.family.id, a.kids[0].id, "robot")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
