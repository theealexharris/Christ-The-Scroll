import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const readingProgressTable = pgTable("reading_progress", {
  visitorId: text("visitor_id").primaryKey(),
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
