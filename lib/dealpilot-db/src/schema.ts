import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/*
 * All DealPilot tables are prefixed `dp_` so they can share a Postgres database
 * with other apps without collisions. Every private row is reachable from a
 * `dp_user` row through a cascading foreign key, so deleting a user deletes
 * all of their data.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Authentication tables, in the shape Better Auth expects (core schema plus the
// anonymous plugin's `is_anonymous` column). Better Auth owns password hashing
// and session management; the app only reads `user.id`.
// ---------------------------------------------------------------------------

export const dpUser = pgTable("dp_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dpSession = pgTable(
  "dp_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_session_user_idx").on(t.userId)],
);

export const dpAccount = pgTable(
  "dp_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_account_user_idx").on(t.userId)],
);

export const dpVerification = pgTable(
  "dp_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Application tables
// ---------------------------------------------------------------------------

export const dpUserPreference = pgTable("dp_user_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => dpUser.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").notNull().default(sql`'{}'::jsonb`),
  updatedAt: updatedAt(),
});

/**
 * Properties. `owner_id` is NULL only for the shared, read-only sample
 * catalog (`is_sample = true`); everything else belongs to one user.
 */
export const dpProperty = pgTable(
  "dp_property",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => dpUser.id, { onDelete: "cascade" }),
    isSample: boolean("is_sample").notNull().default(false),
    sampleKey: text("sample_key"),
    title: text("title").notNull(),
    addressLine: text("address_line").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code"),
    category: text("category").notNull(),
    propertyType: text("property_type").notNull(),
    sourceStatus: text("source_status").notNull(),
    listPrice: doublePrecision("list_price"),
    beds: integer("beds"),
    baths: doublePrecision("baths"),
    units: integer("units"),
    squareFeet: integer("square_feet"),
    lotSizeSqft: integer("lot_size_sqft"),
    yearBuilt: integer("year_built"),
    estimatedRentMonthly: doublePrecision("estimated_rent_monthly"),
    annualTaxes: doublePrecision("annual_taxes"),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("dp_property_owner_idx").on(t.ownerId, t.createdAt),
    index("dp_property_category_idx").on(t.category),
    uniqueIndex("dp_property_catalog_sample_key_idx").on(t.sampleKey).where(sql`${t.ownerId} IS NULL`),
  ],
);

/** Where each property record came from and when it was captured. */
export const dpPropertySourceRecord = pgTable(
  "dp_property_source_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => dpProperty.id, { onDelete: "cascade" }),
    sourceStatus: text("source_status").notNull(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("dp_source_property_idx").on(t.propertyId)],
);

export const dpDeal = pgTable(
  "dp_deal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => dpProperty.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    stage: text("stage").notNull().default("lead"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_deal_owner_idx").on(t.ownerId, t.updatedAt), index("dp_deal_property_idx").on(t.propertyId)],
);

/** Versioned assumption sets; the highest version is current. */
export const dpDealAssumption = pgTable(
  "dp_deal_assumption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    assumptions: jsonb("assumptions").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dp_assumption_deal_version_idx").on(t.dealId, t.version)],
);

/** Immutable underwriting snapshots computed from a specific assumption version. */
export const dpUnderwritingResult = pgTable(
  "dp_underwriting_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    assumptionVersion: integer("assumption_version").notNull(),
    inputs: jsonb("inputs").notNull(),
    outputs: jsonb("outputs").notNull(),
    engineVersion: text("engine_version").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("dp_underwriting_deal_idx").on(t.dealId, t.createdAt)],
);

export const dpFinancingScenario = pgTable(
  "dp_financing_scenario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    params: jsonb("params").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_financing_deal_idx").on(t.dealId)],
);

export const dpWorkflowRun = pgTable(
  "dp_workflow_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    currentStep: text("current_step"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(1),
    aiMode: text("ai_mode"),
    underwritingResultId: uuid("underwriting_result_id").references(() => dpUnderwritingResult.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_workflow_deal_idx").on(t.dealId, t.createdAt), index("dp_workflow_status_idx").on(t.status)],
);

export const dpWorkflowStep = pgTable(
  "dp_workflow_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => dpWorkflowRun.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("pending"),
    output: jsonb("output"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("dp_workflow_step_run_key_idx").on(t.runId, t.key)],
);

/** AI analyst output (structured reviews and Q&A), labelled demo or live. */
export const dpAiMessage = pgTable(
  "dp_ai_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "review" | "question" | "answer"
    mode: text("mode").notNull(), // "demo" | "live"
    provider: text("provider"),
    model: text("model"),
    content: jsonb("content").notNull(),
    workflowRunId: uuid("workflow_run_id").references(() => dpWorkflowRun.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("dp_ai_message_deal_idx").on(t.dealId, t.createdAt)],
);

export const dpDueDiligenceTask = pgTable(
  "dp_due_diligence_task",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    generatedKey: text("generated_key"),
    title: text("title").notNull(),
    category: text("category").notNull(),
    detail: text("detail"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    source: text("source").notNull().default("user"), // "user" | "workflow"
    dueDate: text("due_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("dp_task_deal_idx").on(t.dealId), uniqueIndex("dp_task_deal_generated_idx").on(t.dealId, t.generatedKey)],
);

/** Offer drafts are append-only: each save is a new version. */
export const dpOfferDraft = pgTable(
  "dp_offer_draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    terms: jsonb("terms").notNull(),
    checklist: jsonb("checklist").notNull().default(sql`'{}'::jsonb`),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("dp_offer_deal_version_idx").on(t.dealId, t.version)],
);

/** Export metadata plus the frozen data snapshot the file is rendered from. */
export const dpGeneratedDocument = pgTable(
  "dp_generated_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => dpDeal.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "investment_report" | "offer_draft"
    format: text("format").notNull(), // "pdf" | "docx"
    title: text("title").notNull(),
    offerDraftId: uuid("offer_draft_id").references(() => dpOfferDraft.id, { onDelete: "set null" }),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("dp_document_owner_idx").on(t.ownerId, t.createdAt), index("dp_document_deal_idx").on(t.dealId)],
);

export const dpActivityEvent = pgTable(
  "dp_activity_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => dpDeal.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => dpProperty.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("dp_activity_owner_idx").on(t.ownerId, t.createdAt)],
);

export const dpSavedSearch = pgTable(
  "dp_saved_search",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => dpUser.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("dp_saved_search_owner_idx").on(t.ownerId)],
);

export type DpProperty = typeof dpProperty.$inferSelect;
export type DpDeal = typeof dpDeal.$inferSelect;
export type DpFinancingScenario = typeof dpFinancingScenario.$inferSelect;
export type DpWorkflowRun = typeof dpWorkflowRun.$inferSelect;
export type DpWorkflowStep = typeof dpWorkflowStep.$inferSelect;
export type DpDueDiligenceTask = typeof dpDueDiligenceTask.$inferSelect;
export type DpOfferDraft = typeof dpOfferDraft.$inferSelect;
export type DpGeneratedDocument = typeof dpGeneratedDocument.$inferSelect;
export type DpActivityEvent = typeof dpActivityEvent.$inferSelect;
export type DpAiMessage = typeof dpAiMessage.$inferSelect;
