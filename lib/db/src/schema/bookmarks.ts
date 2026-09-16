import { pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const bookmarkTargetTypes = ["verse", "person", "place", "event", "journey"] as const;

export const bookmarksTable = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),
    targetType: text("target_type", { enum: bookmarkTargetTypes }).notNull(),
    targetRef: text("target_ref").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("bookmarks_user_target_idx").on(table.userId, table.targetType, table.targetRef)],
);

export const insertBookmarkSchema = createInsertSchema(bookmarksTable).omit({ id: true, createdAt: true });
export type InsertBookmark = typeof bookmarksTable.$inferInsert;
export type Bookmark = typeof bookmarksTable.$inferSelect;
