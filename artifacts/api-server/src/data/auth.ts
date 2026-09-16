import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

export async function getUserByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  return row ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return row ?? null;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const [row] = await db.insert(usersTable).values({ email, passwordHash }).returning();
  return row;
}
