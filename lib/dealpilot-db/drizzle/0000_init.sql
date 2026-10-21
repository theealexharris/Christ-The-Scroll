CREATE TABLE "dp_account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_activity_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"deal_id" uuid,
	"property_id" uuid,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_ai_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"mode" text NOT NULL,
	"provider" text,
	"model" text,
	"content" jsonb NOT NULL,
	"workflow_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_deal_assumption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"assumptions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_due_diligence_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"generated_key" text,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"detail" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"due_date" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_financing_scenario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_generated_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"deal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"format" text NOT NULL,
	"title" text NOT NULL,
	"offer_draft_id" uuid,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_offer_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"terms" jsonb NOT NULL,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"is_sample" boolean DEFAULT false NOT NULL,
	"sample_key" text,
	"title" text NOT NULL,
	"address_line" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text,
	"category" text NOT NULL,
	"property_type" text NOT NULL,
	"source_status" text NOT NULL,
	"list_price" double precision,
	"beds" integer,
	"baths" double precision,
	"units" integer,
	"square_feet" integer,
	"lot_size_sqft" integer,
	"year_built" integer,
	"estimated_rent_monthly" double precision,
	"annual_taxes" double precision,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_property_source_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"source_status" text NOT NULL,
	"source_name" text,
	"source_url" text,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dp_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "dp_underwriting_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"assumption_version" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"outputs" jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dp_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "dp_user_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_workflow_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"ai_mode" text,
	"underwriting_result_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dp_workflow_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"key" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dp_account" ADD CONSTRAINT "dp_account_user_id_dp_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_activity_event" ADD CONSTRAINT "dp_activity_event_owner_id_dp_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_activity_event" ADD CONSTRAINT "dp_activity_event_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_activity_event" ADD CONSTRAINT "dp_activity_event_property_id_dp_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."dp_property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_ai_message" ADD CONSTRAINT "dp_ai_message_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_ai_message" ADD CONSTRAINT "dp_ai_message_workflow_run_id_dp_workflow_run_id_fk" FOREIGN KEY ("workflow_run_id") REFERENCES "public"."dp_workflow_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_deal" ADD CONSTRAINT "dp_deal_owner_id_dp_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_deal" ADD CONSTRAINT "dp_deal_property_id_dp_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."dp_property"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_deal_assumption" ADD CONSTRAINT "dp_deal_assumption_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_due_diligence_task" ADD CONSTRAINT "dp_due_diligence_task_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_financing_scenario" ADD CONSTRAINT "dp_financing_scenario_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_generated_document" ADD CONSTRAINT "dp_generated_document_owner_id_dp_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_generated_document" ADD CONSTRAINT "dp_generated_document_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_generated_document" ADD CONSTRAINT "dp_generated_document_offer_draft_id_dp_offer_draft_id_fk" FOREIGN KEY ("offer_draft_id") REFERENCES "public"."dp_offer_draft"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_offer_draft" ADD CONSTRAINT "dp_offer_draft_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_property" ADD CONSTRAINT "dp_property_owner_id_dp_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_property_source_record" ADD CONSTRAINT "dp_property_source_record_property_id_dp_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."dp_property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_saved_search" ADD CONSTRAINT "dp_saved_search_owner_id_dp_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_session" ADD CONSTRAINT "dp_session_user_id_dp_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_underwriting_result" ADD CONSTRAINT "dp_underwriting_result_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_user_preference" ADD CONSTRAINT "dp_user_preference_user_id_dp_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."dp_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_workflow_run" ADD CONSTRAINT "dp_workflow_run_deal_id_dp_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."dp_deal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_workflow_run" ADD CONSTRAINT "dp_workflow_run_underwriting_result_id_dp_underwriting_result_id_fk" FOREIGN KEY ("underwriting_result_id") REFERENCES "public"."dp_underwriting_result"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dp_workflow_step" ADD CONSTRAINT "dp_workflow_step_run_id_dp_workflow_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."dp_workflow_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dp_account_user_idx" ON "dp_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dp_activity_owner_idx" ON "dp_activity_event" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_ai_message_deal_idx" ON "dp_ai_message" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_deal_owner_idx" ON "dp_deal" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "dp_deal_property_idx" ON "dp_deal" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dp_assumption_deal_version_idx" ON "dp_deal_assumption" USING btree ("deal_id","version");--> statement-breakpoint
CREATE INDEX "dp_task_deal_idx" ON "dp_due_diligence_task" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dp_task_deal_generated_idx" ON "dp_due_diligence_task" USING btree ("deal_id","generated_key");--> statement-breakpoint
CREATE INDEX "dp_financing_deal_idx" ON "dp_financing_scenario" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "dp_document_owner_idx" ON "dp_generated_document" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_document_deal_idx" ON "dp_generated_document" USING btree ("deal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dp_offer_deal_version_idx" ON "dp_offer_draft" USING btree ("deal_id","version");--> statement-breakpoint
CREATE INDEX "dp_property_owner_idx" ON "dp_property" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_property_category_idx" ON "dp_property" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "dp_property_catalog_sample_key_idx" ON "dp_property" USING btree ("sample_key") WHERE "dp_property"."owner_id" IS NULL;--> statement-breakpoint
CREATE INDEX "dp_source_property_idx" ON "dp_property_source_record" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "dp_saved_search_owner_idx" ON "dp_saved_search" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "dp_session_user_idx" ON "dp_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dp_underwriting_deal_idx" ON "dp_underwriting_result" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_verification_identifier_idx" ON "dp_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "dp_workflow_deal_idx" ON "dp_workflow_run" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "dp_workflow_status_idx" ON "dp_workflow_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dp_workflow_step_run_key_idx" ON "dp_workflow_step" USING btree ("run_id","key");