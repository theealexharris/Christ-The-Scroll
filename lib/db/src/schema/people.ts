import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const peopleTable = pgTable("people", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  description: text("description").notNull(),
  scriptureReferences: text("scripture_references")
    .array()
    .notNull()
    .default([]),
  sortOrder: integer("sort_order").notNull(),
});

export const insertPersonSchema = createInsertSchema(peopleTable);
export type InsertPerson = typeof peopleTable.$inferInsert;
export type Person = typeof peopleTable.$inferSelect;
