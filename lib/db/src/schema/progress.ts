import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { journeysTable } from "./journeys";

// `ownerId` holds either an authenticated user's id or an anonymous visitor
// cookie id — both are UUID strings, so callers resolve one identity before
// touching any of these tables.

export const readingProgressTable = pgTable("reading_progress", {
  ownerId: text("owner_id").primaryKey(),
  bookSlug: text("book_slug").notNull(),
  chapter: integer("chapter").notNull(),
  verse: integer("verse").notNull(),
  percent: integer("percent").notNull(),
  lastReference: text("last_reference").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReadingProgressSchema = createInsertSchema(readingProgressTable).omit({ updatedAt: true });
export type InsertReadingProgress = typeof readingProgressTable.$inferInsert;
export type ReadingProgress = typeof readingProgressTable.$inferSelect;

export const chapterReadsTable = pgTable(
  "chapter_reads",
  {
    ownerId: text("owner_id").notNull(),
    bookSlug: text("book_slug").notNull(),
    chapter: integer("chapter").notNull(),
    readAt: timestamp("read_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chapter_reads_owner_book_chapter_idx").on(table.ownerId, table.bookSlug, table.chapter)],
);

export type InsertChapterRead = typeof chapterReadsTable.$inferInsert;
export type ChapterRead = typeof chapterReadsTable.$inferSelect;

export const journeyProgressTable = pgTable(
  "journey_progress",
  {
    ownerId: text("owner_id").notNull(),
    journeySlug: text("journey_slug")
      .notNull()
      .references(() => journeysTable.slug),
    currentStopIndex: integer("current_stop_index").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("journey_progress_owner_journey_idx").on(table.ownerId, table.journeySlug)],
);

export type InsertJourneyProgress = typeof journeyProgressTable.$inferInsert;
export type JourneyProgress = typeof journeyProgressTable.$inferSelect;

export const readingPlansTable = pgTable("reading_plans", {
  ownerId: text("owner_id").primaryKey(),
  bookSlug: text("book_slug").notNull(),
  dailyMinutes: integer("daily_minutes").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
});

export const insertReadingPlanSchema = createInsertSchema(readingPlansTable).omit({ startedAt: true });
export type InsertReadingPlan = typeof readingPlansTable.$inferInsert;
export type ReadingPlan = typeof readingPlansTable.$inferSelect;
