CREATE TABLE "auth_attempts" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "auth_attempts_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "children_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"name" text NOT NULL,
	"avatar" text NOT NULL,
	"pin_hash" text NOT NULL,
	"theme" text,
	"goal_reward_id" bigint,
	"archived_at" timestamp with time zone,
	"failed_pin_count" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_theme" CHECK ("children"."theme" is null or theme in ('sunny', 'ocean', 'candy', 'robot', 'magic')),
	CONSTRAINT "children_failed_pin_count" CHECK ("children"."failed_pin_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "families_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"currency_name" text DEFAULT 'Sao' NOT NULL,
	"currency_icon" text DEFAULT 'star' NOT NULL,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"default_theme" text DEFAULT 'sunny' NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "families_currency_name_len" CHECK (char_length("families"."currency_name") between 1 and 20),
	CONSTRAINT "families_default_theme" CHECK (default_theme in ('sunny', 'ocean', 'candy', 'robot', 'magic'))
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"created_by_parent_id" bigint NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_parent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notifications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"child_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"amount" integer,
	"reason" text,
	"transaction_id" bigint,
	"ref_type" text,
	"ref_id" bigint,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_kind" CHECK (kind in ('gift', 'penalty', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "parents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parents_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"child_id" bigint NOT NULL,
	"reward_id" bigint NOT NULL,
	"price_snapshot" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"decided_by_parent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "redemptions_status" CHECK (status in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "redemptions_price_positive" CHECK ("redemptions"."price_snapshot" > 0)
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rewards_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"icon" text NOT NULL,
	"description" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rewards_price_positive" CHECK ("rewards"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "rule_claims" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rule_claims_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"child_id" bigint NOT NULL,
	"rule_id" bigint NOT NULL,
	"name_snapshot" text NOT NULL,
	"points_snapshot" integer NOT NULL,
	"note" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"decided_by_parent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "rule_claims_status" CHECK (status in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "rule_claims_points_positive" CHECK ("rule_claims"."points_snapshot" > 0)
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"icon" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rules_kind" CHECK (kind in ('reward', 'penalty')),
	CONSTRAINT "rules_points_positive" CHECK ("rules"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_subject_type" CHECK (subject_type in ('parent', 'device', 'child'))
);
--> statement-breakpoint
CREATE TABLE "task_assignees" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_assignees_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"task_id" bigint NOT NULL,
	"child_id" bigint NOT NULL,
	"effective_from" date NOT NULL,
	"removed_from" date,
	CONSTRAINT "task_assignees_range" CHECK ("task_assignees"."removed_from" is null or "task_assignees"."removed_from" > "task_assignees"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "task_days" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "task_days_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"task_id" bigint NOT NULL,
	"child_id" bigint,
	"date" date NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"reported_by_child_id" bigint,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_days_status" CHECK (status in ('todo', 'pending', 'done'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"name" text NOT NULL,
	"points" integer NOT NULL,
	"mode" text NOT NULL,
	"assign_all" boolean DEFAULT false NOT NULL,
	"weekdays_mask" smallint DEFAULT 127 NOT NULL,
	"effective_from" date NOT NULL,
	"paused_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_mode" CHECK (mode in ('individual', 'group')),
	CONSTRAINT "tasks_points_positive" CHECK ("tasks"."points" > 0),
	CONSTRAINT "tasks_weekdays_mask" CHECK ("tasks"."weekdays_mask" between 1 and 127)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"family_id" bigint NOT NULL,
	"child_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"requested_amount" integer NOT NULL,
	"applied_amount" integer NOT NULL,
	"description" text NOT NULL,
	"actor_parent_id" bigint NOT NULL,
	"ref_type" text,
	"ref_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_kind" CHECK (kind in ('rule', 'task', 'adhoc', 'redeem', 'adjust')),
	CONSTRAINT "transactions_applied_within_requested" CHECK (("transactions"."requested_amount" >= 0 and "transactions"."applied_amount" = "transactions"."requested_amount") or ("transactions"."requested_amount" < 0 and "transactions"."applied_amount" between "transactions"."requested_amount" and 0))
);
--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_goal_reward_id_rewards_id_fk" FOREIGN KEY ("goal_reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_parent_id_parents_id_fk" FOREIGN KEY ("created_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_parent_id_parents_id_fk" FOREIGN KEY ("used_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_decided_by_parent_id_parents_id_fk" FOREIGN KEY ("decided_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_claims" ADD CONSTRAINT "rule_claims_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_claims" ADD CONSTRAINT "rule_claims_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_claims" ADD CONSTRAINT "rule_claims_decided_by_parent_id_parents_id_fk" FOREIGN KEY ("decided_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_days" ADD CONSTRAINT "task_days_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_days" ADD CONSTRAINT "task_days_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_days" ADD CONSTRAINT "task_days_reported_by_child_id_children_id_fk" FOREIGN KEY ("reported_by_child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_actor_parent_id_parents_id_fk" FOREIGN KEY ("actor_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "children_family_idx" ON "children" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "notifications_child_read_idx" ON "notifications" USING btree ("child_id","read_at");--> statement-breakpoint
CREATE INDEX "redemptions_child_status_idx" ON "redemptions" USING btree ("child_id","status");--> statement-breakpoint
CREATE INDEX "rewards_family_idx" ON "rewards" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "rule_claims_child_status_idx" ON "rule_claims" USING btree ("child_id","status");--> statement-breakpoint
CREATE INDEX "rules_family_idx" ON "rules" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "sessions_subject_idx" ON "sessions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "task_assignees_task_idx" ON "task_assignees" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_days_individual_uq" ON "task_days" USING btree ("task_id","child_id","date") WHERE "task_days"."child_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "task_days_group_uq" ON "task_days" USING btree ("task_id","date") WHERE "task_days"."child_id" is null;--> statement-breakpoint
CREATE INDEX "tasks_family_idx" ON "tasks" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "transactions_child_idx" ON "transactions" USING btree ("child_id","id");--> statement-breakpoint
CREATE INDEX "transactions_family_created_idx" ON "transactions" USING btree ("family_id","created_at");