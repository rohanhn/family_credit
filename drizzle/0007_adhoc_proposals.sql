CREATE TABLE "adhoc_proposals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "adhoc_proposals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"child_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"proposed_points" integer NOT NULL,
	"approved_points" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"decided_by_parent_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "adhoc_proposals_kind" CHECK (kind in ('reward', 'penalty')),
	CONSTRAINT "adhoc_proposals_status" CHECK (status in ('pending', 'approved', 'rejected', 'cancelled')),
	CONSTRAINT "adhoc_proposals_proposed_positive" CHECK ("adhoc_proposals"."proposed_points" > 0),
	CONSTRAINT "adhoc_proposals_approved_positive" CHECK ("adhoc_proposals"."approved_points" is null or "adhoc_proposals"."approved_points" > 0)
);
--> statement-breakpoint
ALTER TABLE "adhoc_proposals" ADD CONSTRAINT "adhoc_proposals_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adhoc_proposals" ADD CONSTRAINT "adhoc_proposals_decided_by_parent_id_parents_id_fk" FOREIGN KEY ("decided_by_parent_id") REFERENCES "public"."parents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adhoc_proposals_child_status_idx" ON "adhoc_proposals" USING btree ("child_id","status");