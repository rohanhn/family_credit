import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedClock, DAY } from "@/server/clock";
import { parents } from "@/server/db/schema";
import { registerParent } from "@/server/auth/parent-auth";
import { acceptInvite, createFamily, createInvite, inspectInvite } from "@/server/domain/families";
import { createTestDb, type TestDb } from "../helpers/db";

let t: TestDb;
const clock = fixedClock("2026-11-09T10:00:00Z");
beforeEach(async () => {
  t = await createTestDb();
  clock.set("2026-11-09T10:00:00Z");
});
afterEach(async () => {
  await t.close();
});

const newParent = async (email: string) =>
  (await registerParent(t.db, { email, password: "matkhau123", displayName: "Mẹ" }, { ip: email, clock })).parentId;
const familyOf = async (parentId: number) => (await t.db.select().from(parents).where(eq(parents.id, parentId)))[0].familyId;

describe("Tạo gia đình", () => {
  it("Tạo gia đình lần đầu: người tạo trở thành bố mẹ của gia đình", async () => {
    const p = await newParent("bo@example.com");
    const family = await createFamily(t.db, p, { name: " Nhà Bin & Na " });
    expect(family).toMatchObject({ name: "Nhà Bin & Na", currencyName: "Sao", defaultTheme: "sunny" });
    expect(await familyOf(p)).toBe(family.id);
  });

  it("Đã có gia đình thì không tạo thêm được", async () => {
    const p = await newParent("bo@example.com");
    await createFamily(t.db, p, { name: "Nhà A" });
    await expect(createFamily(t.db, p, { name: "Nhà B" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("Mời bố mẹ khác", () => {
  async function familyWithInvite() {
    const bo = await newParent("bo@example.com");
    const family = await createFamily(t.db, bo, { name: "Nhà A" });
    const invite = await createInvite(t.db, { parentId: bo, familyId: family.id }, clock);
    return { bo, family, invite };
  }

  it("Chấp nhận lời mời hợp lệ: thành bố mẹ của gia đình, liên kết hết hiệu lực", async () => {
    const { family, invite } = await familyWithInvite();
    expect(await inspectInvite(t.db, invite.token, clock)).toEqual({ valid: true, familyName: "Nhà A" });
    const me = await newParent("me@example.com");
    expect(await acceptInvite(t.db, me, invite.token, clock)).toEqual({ familyId: family.id });
    expect(await familyOf(me)).toBe(family.id);
    expect(await inspectInvite(t.db, invite.token, clock)).toEqual({ valid: false });
  });

  it("Lời mời đã dùng", async () => {
    const { invite } = await familyWithInvite();
    await acceptInvite(t.db, await newParent("me@example.com"), invite.token, clock);
    await expect(acceptInvite(t.db, await newParent("ba@example.com"), invite.token, clock)).rejects.toMatchObject({ message: "Lời mời không còn hiệu lực" });
  });

  it("Lời mời hết hạn sau 7 ngày", async () => {
    const { invite } = await familyWithInvite();
    const me = await newParent("me@example.com");
    clock.advance(7 * DAY);
    expect(await inspectInvite(t.db, invite.token, clock)).toEqual({ valid: false });
    await expect(acceptInvite(t.db, me, invite.token, clock)).rejects.toMatchObject({ message: "Lời mời không còn hiệu lực" });
    expect(await familyOf(me)).toBeNull();
  });

  it("Token sai không lộ thông tin", async () => {
    await familyWithInvite();
    expect(await inspectInvite(t.db, "khong-ton-tai", clock)).toEqual({ valid: false });
  });

  it("Tài khoản đã có gia đình không nhận lời mời khác", async () => {
    const { invite } = await familyWithInvite();
    const other = await newParent("khac@example.com");
    await createFamily(t.db, other, { name: "Nhà B" });
    await expect(acceptInvite(t.db, other, invite.token, clock)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("Tạo quá nhiều lời mời: lời mời thứ 11 trong ngày bị từ chối", async () => {
    const { bo, family } = await familyWithInvite(); // đã tạo 1
    for (let i = 0; i < 9; i++) await createInvite(t.db, { parentId: bo, familyId: family.id }, clock);
    await expect(createInvite(t.db, { parentId: bo, familyId: family.id }, clock)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    clock.advance(DAY);
    await expect(createInvite(t.db, { parentId: bo, familyId: family.id }, clock)).resolves.toBeTruthy();
  });
});
