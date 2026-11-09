ALTER TABLE "children" ADD COLUMN "pin_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "device_child_id" bigint;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_child_id_children_id_fk" FOREIGN KEY ("device_child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_device_child_idx" ON "sessions" USING btree ("device_child_id");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_child_only_device" CHECK ("sessions"."device_child_id" is null or "sessions"."subject_type" = 'device');