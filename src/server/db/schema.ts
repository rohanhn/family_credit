import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Mô hình dữ liệu theo design D2/D3: khóa chính bigint identity, thời điểm timestamptz,
// ngày của nhiệm vụ là date, giá trị liệt kê dùng text + CHECK.

const id = () => bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();
const ref = (name: string) => bigint(name, { mode: "number" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const THEME_VALUES = ["sunny", "ocean", "candy", "robot", "magic"] as const;

export const families = pgTable(
  "families",
  {
    id: id(),
    name: text("name").notNull(),
    currencyName: text("currency_name").notNull().default("Sao"),
    currencyIcon: text("currency_icon").notNull().default("star"),
    timezone: text("timezone").notNull().default("Asia/Ho_Chi_Minh"),
    defaultTheme: text("default_theme").notNull().default("sunny"),
    soundEnabled: boolean("sound_enabled").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("families_currency_name_len", sql`char_length(${t.currencyName}) between 1 and 20`),
    check("families_default_theme", inList("default_theme", THEME_VALUES)),
  ],
);

export const parents = pgTable("parents", {
  id: id(),
  familyId: ref("family_id").references(() => families.id),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const invites = pgTable("invites", {
  id: id(),
  familyId: ref("family_id")
    .notNull()
    .references(() => families.id),
  createdByParentId: ref("created_by_parent_id")
    .notNull()
    .references(() => parents.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  usedByParentId: ref("used_by_parent_id").references(() => parents.id),
  createdAt: createdAt(),
});

export const rewards = pgTable(
  "rewards",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    icon: text("icon").notNull(),
    description: text("description"),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [check("rewards_price_positive", sql`${t.price} > 0`), index("rewards_family_idx").on(t.familyId)],
);

export const children = pgTable(
  "children",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    avatar: text("avatar").notNull(),
    pinHash: text("pin_hash").notNull(),
    theme: text("theme"),
    goalRewardId: ref("goal_reward_id").references((): AnyPgColumn => rewards.id),
    archivedAt: ts("archived_at"),
    failedPinCount: smallint("failed_pin_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    createdAt: createdAt(),
  },
  (t) => [
    check("children_theme", sql`${t.theme} is null or ${inList("theme", THEME_VALUES)}`),
    check("children_failed_pin_count", sql`${t.failedPinCount} >= 0`),
    index("children_family_idx").on(t.familyId),
  ],
);

export const RULE_KINDS = ["reward", "penalty"] as const;

export const rules = pgTable(
  "rules",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    kind: text("kind", { enum: RULE_KINDS }).notNull(),
    points: integer("points").notNull(),
    icon: text("icon"),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("rules_kind", inList("kind", RULE_KINDS)),
    check("rules_points_positive", sql`${t.points} > 0`),
    index("rules_family_idx").on(t.familyId),
  ],
);

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export const ruleClaims = pgTable(
  "rule_claims",
  {
    id: id(),
    childId: ref("child_id")
      .notNull()
      .references(() => children.id),
    ruleId: ref("rule_id")
      .notNull()
      .references(() => rules.id),
    nameSnapshot: text("name_snapshot").notNull(),
    pointsSnapshot: integer("points_snapshot").notNull(),
    note: text("note"),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("pending"),
    reason: text("reason"),
    decidedByParentId: ref("decided_by_parent_id").references(() => parents.id),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
  },
  (t) => [
    check("rule_claims_status", inList("status", REQUEST_STATUSES)),
    check("rule_claims_points_positive", sql`${t.pointsSnapshot} > 0`),
    index("rule_claims_child_status_idx").on(t.childId, t.status),
  ],
);

export const TASK_MODES = ["individual", "group"] as const;

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id),
    name: text("name").notNull(),
    points: integer("points").notNull(),
    mode: text("mode", { enum: TASK_MODES }).notNull(),
    assignAll: boolean("assign_all").notNull().default(false),
    /** Bit 0 = thứ Hai ... bit 6 = Chủ nhật. */
    weekdaysMask: smallint("weekdays_mask").notNull().default(127),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    pausedFrom: date("paused_from", { mode: "string" }),
    /** Sửa nhiệm vụ tạo phiên bản mới có hiệu lực từ hôm sau; bản cũ trỏ sang bản mới (design D3). */
    replacedByTaskId: ref("replaced_by_task_id").references((): AnyPgColumn => tasks.id),
    createdAt: createdAt(),
  },
  (t) => [
    check("tasks_mode", inList("mode", TASK_MODES)),
    check("tasks_points_positive", sql`${t.points} > 0`),
    check("tasks_weekdays_mask", sql`${t.weekdaysMask} between 1 and 127`),
    index("tasks_family_idx").on(t.familyId),
  ],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: id(),
    taskId: ref("task_id")
      .notNull()
      .references(() => tasks.id),
    childId: ref("child_id")
      .notNull()
      .references(() => children.id),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    removedFrom: date("removed_from", { mode: "string" }),
  },
  (t) => [
    check("task_assignees_range", sql`${t.removedFrom} is null or ${t.removedFrom} > ${t.effectiveFrom}`),
    index("task_assignees_task_idx").on(t.taskId),
  ],
);

export const TASK_DAY_STATUSES = ["todo", "pending", "done"] as const;

export const taskDays = pgTable(
  "task_days",
  {
    id: id(),
    taskId: ref("task_id")
      .notNull()
      .references(() => tasks.id),
    /** null = dòng chung của nhiệm vụ nhóm. */
    childId: ref("child_id").references(() => children.id),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status", { enum: TASK_DAY_STATUSES }).notNull().default("todo"),
    reportedByChildId: ref("reported_by_child_id").references(() => children.id),
    rejectReason: text("reject_reason"),
    updatedAt: createdAt(),
  },
  (t) => [
    check("task_days_status", inList("status", TASK_DAY_STATUSES)),
    // PostgreSQL coi NULL là khác nhau trong UNIQUE nên cần hai partial unique index (design D3).
    uniqueIndex("task_days_individual_uq").on(t.taskId, t.childId, t.date).where(sql`${t.childId} is not null`),
    uniqueIndex("task_days_group_uq").on(t.taskId, t.date).where(sql`${t.childId} is null`),
  ],
);

export const redemptions = pgTable(
  "redemptions",
  {
    id: id(),
    childId: ref("child_id")
      .notNull()
      .references(() => children.id),
    rewardId: ref("reward_id")
      .notNull()
      .references(() => rewards.id),
    nameSnapshot: text("name_snapshot").notNull(),
    priceSnapshot: integer("price_snapshot").notNull(),
    status: text("status", { enum: REQUEST_STATUSES }).notNull().default("pending"),
    reason: text("reason"),
    decidedByParentId: ref("decided_by_parent_id").references(() => parents.id),
    createdAt: createdAt(),
    decidedAt: ts("decided_at"),
  },
  (t) => [
    check("redemptions_status", inList("status", REQUEST_STATUSES)),
    check("redemptions_price_positive", sql`${t.priceSnapshot} > 0`),
    index("redemptions_child_status_idx").on(t.childId, t.status),
    // Mỗi con tối đa một yêu cầu đang chờ cho mỗi phần thưởng (spec reward-shop).
    uniqueIndex("redemptions_pending_uq").on(t.childId, t.rewardId).where(sql`${t.status} = 'pending'`),
  ],
);

export const TRANSACTION_KINDS = ["rule", "task", "adhoc", "redeem", "adjust"] as const;

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    familyId: ref("family_id")
      .notNull()
      .references(() => families.id),
    childId: ref("child_id")
      .notNull()
      .references(() => children.id),
    kind: text("kind", { enum: TRANSACTION_KINDS }).notNull(),
    requestedAmount: integer("requested_amount").notNull(),
    appliedAmount: integer("applied_amount").notNull(),
    description: text("description").notNull(),
    actorParentId: ref("actor_parent_id")
      .notNull()
      .references(() => parents.id),
    refType: text("ref_type"),
    refId: ref("ref_id"),
    createdAt: createdAt(),
  },
  (t) => [
    check("transactions_kind", inList("kind", TRANSACTION_KINDS)),
    // Mức thực ghi cùng dấu và không vượt mức gốc (số dư không âm, spec currency-ledger).
    check(
      "transactions_applied_within_requested",
      sql`(${t.requestedAmount} >= 0 and ${t.appliedAmount} = ${t.requestedAmount}) or (${t.requestedAmount} < 0 and ${t.appliedAmount} between ${t.requestedAmount} and 0)`,
    ),
    index("transactions_child_idx").on(t.childId, t.id),
    index("transactions_family_created_idx").on(t.familyId, t.createdAt),
  ],
);

export const NOTIFICATION_KINDS = ["gift", "penalty", "rejected"] as const;

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    childId: ref("child_id")
      .notNull()
      .references(() => children.id),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    title: text("title").notNull(),
    amount: integer("amount"),
    reason: text("reason"),
    transactionId: ref("transaction_id").references(() => transactions.id),
    refType: text("ref_type"),
    refId: ref("ref_id"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    check("notifications_kind", inList("kind", NOTIFICATION_KINDS)),
    index("notifications_child_read_idx").on(t.childId, t.readAt),
  ],
);

export const SESSION_SUBJECTS = ["parent", "device", "child"] as const;

export const sessions = pgTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    subjectType: text("subject_type", { enum: SESSION_SUBJECTS }).notNull(),
    /** parent: parents.id; device: families.id; child: children.id. */
    subjectId: ref("subject_id").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("sessions_subject_type", inList("subject_type", SESSION_SUBJECTS)),
    index("sessions_subject_idx").on(t.subjectType, t.subjectId),
  ],
);

export const authAttempts = pgTable(
  "auth_attempts",
  {
    key: text("key").notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
