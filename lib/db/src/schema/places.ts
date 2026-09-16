import { doublePrecision, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const placeConfidenceValues = ["known", "approximate", "disputed", "traditional"] as const;

export const placesTable = pgTable("places", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  confidence: text("confidence", { enum: placeConfidenceValues }).notNull(),
  ancientName: text("ancient_name"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  historicalNotes: text("historical_notes"),
  scriptureReferences: text("scripture_references")
    .array()
    .notNull()
    .default([]),
});

export const insertPlaceSchema = createInsertSchema(placesTable);
export type InsertPlace = typeof placesTable.$inferInsert;
export type Place = typeof placesTable.$inferSelect;
