import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const testamentValues = ["old", "new"] as const;

export const booksTable = pgTable("books", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  testament: text("testament", { enum: testamentValues }).notNull(),
  category: text("category").notNull(),
  chapterCount: integer("chapter_count").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const insertBookSchema = createInsertSchema(booksTable);
export type InsertBook = typeof booksTable.$inferInsert;
export type Book = typeof booksTable.$inferSelect;

export const versesTable = pgTable(
  "verses",
  {
    id: text("id").primaryKey(),
    bookSlug: text("book_slug")
      .notNull()
      .references(() => booksTable.slug),
    chapter: integer("chapter").notNull(),
    verse: integer("verse").notNull(),
    text: text("text").notNull(),
    reference: text("reference").notNull(),
    translation: text("translation").notNull().default("KJV"),
  },
  (table) => [uniqueIndex("verses_book_chapter_verse_idx").on(table.bookSlug, table.chapter, table.verse)],
);

export const insertVerseSchema = createInsertSchema(versesTable);
export type InsertVerse = typeof versesTable.$inferInsert;
export type Verse = typeof versesTable.$inferSelect;
