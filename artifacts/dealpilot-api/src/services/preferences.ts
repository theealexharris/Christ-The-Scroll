import { eq } from "drizzle-orm";
import { PreferencesSchema, type Preferences } from "@workspace/dealpilot-core";
import { dpUserPreference, type DpDb } from "@workspace/dealpilot-db";

export async function getPreferences(db: DpDb, userId: string): Promise<Preferences> {
  const [row] = await db.select().from(dpUserPreference).where(eq(dpUserPreference.userId, userId));
  const parsed = PreferencesSchema.safeParse(row?.preferences ?? {});
  return parsed.success ? parsed.data : PreferencesSchema.parse({});
}

export async function savePreferences(db: DpDb, userId: string, prefs: Preferences): Promise<Preferences> {
  await db
    .insert(dpUserPreference)
    .values({ userId, preferences: prefs })
    .onConflictDoUpdate({ target: dpUserPreference.userId, set: { preferences: prefs, updatedAt: new Date() } });
  return prefs;
}
