import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixedClock, DAY } from "@/server/clock";
import { notifications, transactions } from "@/server/db/schema";
import { applyLedgerEntry } from "@/server/domain/ledger";
import {
  cleanupNotifications,
  getUnreadSummary,
  listNotifications,
  markRead,
  notifyRejected,
} from "@/server/domain/notifications";
import { createTestDb, type TestDb } from "../helpers/db";
import { seedFamily } from "../helpers/seed";

let t: TestDb;
beforeEach(async () => {
  t = await createTestDb();
});
afterEach(async () => {
  await t.close();
});

async function setup() {
  const { family, parent, kids } = await seedFamily(t.db, { kids: ["Bin", "Na"] });
  const record = (childId: number, amount: number, description: string, kind: "adhoc" | "rule" | "task" | "redeem" = "adhoc", notifyTitle?: string) =>
    applyLedgerEntry(t.db, { familyId: family.id, childId, kind, amount, description, actorParentId: parent.id, notifyTitle });
  return { family, parent, bin: kids[0], na: kids[1], record };
}

describe("spec kid-notifications: Tạo thông báo cho con", () => {
  it("Thưởng (duyệt nhiệm vụ) tạo thông báo nhận quà +15", async () => {
    const { bin, record } = await setup();
    const txn = await record(bin.id, 15, "Làm bài tập", "task");
    const { count, items } = await getUnreadSummary(t.db, bin.id);
    expect(count).toBe(1);
    expect(items[0]).toMatchObject({ kind: "gift", title: "Làm bài tập", amount: 15, transactionId: txn.id, readAt: null });
  });

  it("Duyệt đổi thưởng tạo thông báo nhận quà dù số điểm âm", async () => {
    const { bin, record } = await setup();
    await record(bin.id, 60, "Thưởng");
    await record(bin.id, -50, "30 phút chơi game", "redeem", "Bố mẹ đã duyệt: 30 phút chơi game");
    const { items } = await getUnreadSummary(t.db, bin.id);
    expect(items[1]).toMatchObject({ kind: "gift", title: "Bố mẹ đã duyệt: 30 phút chơi game", amount: -50 });
  });

  it("Bị phạt: thông báo bị trừ điểm với tên rule và số điểm thực trừ", async () => {
    const { bin, record } = await setup();
    await record(bin.id, 30, "Thưởng");
    await record(bin.id, -10, "Nói dối", "rule");
    const { items } = await getUnreadSummary(t.db, bin.id);
    expect(items[1]).toMatchObject({ kind: "penalty", title: "Nói dối", amount: -10, requestedAmount: -10 });
  });

  it("Phạt khi số dư 0: vẫn có thông báo bị trừ điểm, kèm mức gốc", async () => {
    const { bin, record } = await setup();
    await record(bin.id, -10, "Nói dối", "rule");
    const { items } = await getUnreadSummary(t.db, bin.id);
    expect(items[0]).toMatchObject({ kind: "penalty", amount: 0, requestedAmount: -10 });
  });

  it("Yêu cầu bị từ chối: thông báo kèm tên mục và lý do, không có giao dịch", async () => {
    const { bin } = await setup();
    await notifyRejected(t.db, { childId: bin.id, title: "Đổi: 30 phút chơi game", reason: "Tối nay không chơi game", refType: "redemption", refId: 1 });
    const { items } = await getUnreadSummary(t.db, bin.id);
    expect(items[0]).toMatchObject({ kind: "rejected", title: "Đổi: 30 phút chơi game", reason: "Tối nay không chơi game", amount: null, transactionId: null });
  });
});

describe("spec kid-notifications: đọc và lưu giữ thông báo", () => {
  it("Con không đọc được và không đánh dấu được thông báo của anh chị em", async () => {
    const { bin, na, record } = await setup();
    await record(na.id, 5, "Của Na");
    expect((await getUnreadSummary(t.db, bin.id)).count).toBe(0);
    expect(await listNotifications(t.db, bin.id)).toEqual([]);
    const naItems = (await getUnreadSummary(t.db, na.id)).items;
    expect(await markRead(t.db, bin.id, naItems.map((n) => n.id))).toBe(0);
    expect((await getUnreadSummary(t.db, na.id)).count).toBe(1);
  });

  it("Đánh dấu đã đọc làm giảm số chưa đọc; danh sách mới nhất trước", async () => {
    const { bin, record } = await setup();
    await record(bin.id, 15, "Một");
    await record(bin.id, 5, "Hai");
    const { items } = await getUnreadSummary(t.db, bin.id);
    expect(items.map((n) => n.title)).toEqual(["Một", "Hai"]);
    expect(await markRead(t.db, bin.id, [items[0].id])).toBe(1);
    expect((await getUnreadSummary(t.db, bin.id)).count).toBe(1);
    expect((await listNotifications(t.db, bin.id)).map((n) => n.title)).toEqual(["Hai", "Một"]);
  });

  it("Dọn mọi thông báo quá 30 ngày, kể cả chưa đọc; giữ thông báo mới và sổ cái", async () => {
    const { bin, record } = await setup();
    await record(bin.id, 5, "Cũ đã đọc");
    await record(bin.id, 5, "Cũ chưa đọc");
    const { items } = await getUnreadSummary(t.db, bin.id);
    await markRead(t.db, bin.id, [items[0].id]);
    const later = fixedClock(new Date(Date.now() + 31 * DAY));
    await t.db.insert(notifications).values({ childId: bin.id, kind: "gift", title: "Mới", amount: 1, createdAt: later.now() });
    expect(await cleanupNotifications(t.db, later)).toBe(2);
    const left = await t.db.select().from(notifications);
    expect(left.map((n) => n.title)).toEqual(["Mới"]);
    expect(await t.db.select().from(transactions)).toHaveLength(2);
    // Danh sách 30 ngày không hiện thông báo quá cũ.
    expect((await listNotifications(t.db, bin.id, later)).map((n) => n.title)).toEqual(["Mới"]);
  });

  it("Số chưa đọc chỉ đếm thông báo trong 30 ngày, khớp danh sách", async () => {
    const { bin } = await setup();
    const now = fixedClock("2026-11-10T03:00:00Z");
    await t.db.insert(notifications).values([
      { childId: bin.id, kind: "gift", title: "Quá cũ", amount: 1, createdAt: new Date(now.now().getTime() - 31 * DAY) },
      { childId: bin.id, kind: "gift", title: "Mới 1", amount: 1, createdAt: new Date(now.now().getTime() - DAY) },
      { childId: bin.id, kind: "gift", title: "Mới 2", amount: 1, createdAt: now.now() },
    ]);
    const summary = await getUnreadSummary(t.db, bin.id, now);
    expect(summary.count).toBe(2);
    expect(summary.items.map((n) => n.title)).toEqual(["Mới 1", "Mới 2"]);
    const unreadInList = (await listNotifications(t.db, bin.id, now)).filter((n) => n.readAt === null);
    expect(unreadInList).toHaveLength(2);
  });

  it("Phạt vượt số dư: thông báo lưu mức thực trừ để chuông hiện −3", async () => {
    const { bin, record } = await setup();
    await record(bin.id, 3, "Thưởng");
    await record(bin.id, -10, "Nói dối");
    const [penalty] = (await listNotifications(t.db, bin.id)).filter((n) => n.kind === "penalty");
    expect(penalty).toMatchObject({ amount: -3, requestedAmount: -10 });
  });
});
