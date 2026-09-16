import { integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { placesTable } from "./places";

export const journeysTable = pgTable("journeys", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull(),
  durationLabel: text("duration_label").notNull(),
});

export const insertJourneySchema = createInsertSchema(journeysTable);
export type InsertJourney = typeof journeysTable.$inferInsert;
export type Journey = typeof journeysTable.$inferSelect;

export const journeyStopsTable = pgTable(
  "journey_stops",
  {
    id: serial("id").primaryKey(),
    journeySlug: text("journey_slug")
      .notNull()
      .references(() => journeysTable.slug),
    sortOrder: integer("sort_order").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull(),
    description: text("description").notNull(),
    placeSlug: text("place_slug")
      .notNull()
      .references(() => placesTable.slug),
    scriptureReferences: text("scripture_references")
      .array()
      .notNull()
      .default([]),
  },
  (table) => [uniqueIndex("journey_stops_journey_sort_idx").on(table.journeySlug, table.sortOrder)],
);

export const insertJourneyStopSchema = createInsertSchema(journeyStopsTable).omit({ id: true });
export type InsertJourneyStop = typeof journeyStopsTable.$inferInsert;
export type JourneyStop = typeof journeyStopsTable.$inferSelect;
