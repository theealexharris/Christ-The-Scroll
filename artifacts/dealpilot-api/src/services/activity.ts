import { and, desc, eq } from "drizzle-orm";
import { dpActivityEvent, type DpDb } from "@workspace/dealpilot-db";

export type ActivityInput = {
  ownerId: string;
  type: string;
  message: string;
  dealId?: string | null;
  propertyId?: string | null;
};

export async function logActivity(db: DpDb, input: ActivityInput): Promise<void> {
  await db.insert(dpActivityEvent).values({
    ownerId: input.ownerId,
    type: input.type,
    message: input.message,
    dealId: input.dealId ?? null,
    propertyId: input.propertyId ?? null,
  });
}

export async function listActivity(db: DpDb, ownerId: string, options: { dealId?: string; limit?: number } = {}) {
  const where = options.dealId ? and(eq(dpActivityEvent.ownerId, ownerId), eq(dpActivityEvent.dealId, options.dealId)) : eq(dpActivityEvent.ownerId, ownerId);
  return db
    .select()
    .from(dpActivityEvent)
    .where(where)
    .orderBy(desc(dpActivityEvent.createdAt))
    .limit(Math.min(options.limit ?? 50, 200));
}
