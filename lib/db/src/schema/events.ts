import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const eventsTable = pgTable("events", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  summary: text("summary").notNull(),
  period: text("period").notNull(),
  dateLabel: text("date_label").notNull(),
  before: text("before"),
  after: text("after"),
  scriptureReferences: text("scripture_references")
    .array()
    .notNull()
    .default([]),
  sortOrder: integer("sort_order").notNull(),
});

export const insertEventSchema = createInsertSchema(eventsTable);
export type InsertEvent = typeof eventsTable.$inferInsert;
export type Event = typeof eventsTable.$inferSelect;
