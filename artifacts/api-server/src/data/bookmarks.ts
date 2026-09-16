import { and, desc, eq } from "drizzle-orm";
import { db, bookmarksTable } from "@workspace/db";
import type { Bookmark, BookmarkInput } from "@workspace/api-zod";

function toBookmark(row: typeof bookmarksTable.$inferSelect): Bookmark {
  return { id: row.id, targetType: row.targetType, targetRef: row.targetRef, createdAt: row.createdAt };
}

export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const rows = await db.select().from(bookmarksTable).where(eq(bookmarksTable.userId, userId)).orderBy(desc(bookmarksTable.createdAt));
  return rows.map(toBookmark);
}

export async function createBookmark(userId: string, input: BookmarkInput): Promise<Bookmark> {
  const [row] = await db
    .insert(bookmarksTable)
    .values({ userId, targetType: input.targetType, targetRef: input.targetRef })
    .onConflictDoUpdate({
      target: [bookmarksTable.userId, bookmarksTable.targetType, bookmarksTable.targetRef],
      set: { targetType: input.targetType },
    })
    .returning();
  return toBookmark(row);
}

export async function deleteBookmark(userId: string, id: number): Promise<boolean> {
  const rows = await db
    .delete(bookmarksTable)
    .where(and(eq(bookmarksTable.id, id), eq(bookmarksTable.userId, userId)))
    .returning({ id: bookmarksTable.id });
  return rows.length > 0;
}
