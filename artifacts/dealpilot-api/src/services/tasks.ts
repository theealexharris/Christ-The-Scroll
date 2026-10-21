import { and, asc, eq, sql } from "drizzle-orm";
import { generateDueDiligenceTasks } from "@workspace/dealpilot-core";
import { dpDueDiligenceTask, type DpDb } from "@workspace/dealpilot-db";
import { notFound } from "../lib/http";
import { logActivity } from "./activity";
import { getOwnedDeal, type DealContext } from "./deals";

const priorityOrder = sql`case ${dpDueDiligenceTask.priority} when 'high' then 0 when 'medium' then 1 else 2 end`;

export async function listTasks(db: DpDb, userId: string, dealId: string) {
  await getOwnedDeal(db, userId, dealId);
  return db
    .select()
    .from(dpDueDiligenceTask)
    .where(eq(dpDueDiligenceTask.dealId, dealId))
    .orderBy(asc(sql`case ${dpDueDiligenceTask.status} when 'done' then 1 when 'not_applicable' then 1 else 0 end`), asc(priorityOrder), asc(dpDueDiligenceTask.createdAt));
}

export async function createTask(
  db: DpDb,
  userId: string,
  dealId: string,
  input: { title: string; category: string; detail?: string | null; priority: string; dueDate?: string | null },
) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const [row] = await db
    .insert(dpDueDiligenceTask)
    .values({ dealId: deal.id, title: input.title, category: input.category, detail: input.detail ?? null, priority: input.priority, dueDate: input.dueDate ?? null, source: "user" })
    .returning();
  await logActivity(db, { ownerId: userId, dealId, type: "task.created", message: `Added task "${row.title}".` });
  return row;
}

async function getOwnedTask(db: DpDb, userId: string, dealId: string, taskId: string) {
  await getOwnedDeal(db, userId, dealId);
  const [row] = await db.select().from(dpDueDiligenceTask).where(and(eq(dpDueDiligenceTask.id, taskId), eq(dpDueDiligenceTask.dealId, dealId)));
  if (!row) throw notFound("Task");
  return row;
}

export async function updateTask(db: DpDb, userId: string, dealId: string, taskId: string, patch: Partial<{ title: string; category: string; detail: string | null; priority: string; dueDate: string | null; status: string }>) {
  const task = await getOwnedTask(db, userId, dealId, taskId);
  const [row] = await db.update(dpDueDiligenceTask).set(patch).where(eq(dpDueDiligenceTask.id, task.id)).returning();
  if (patch.status && patch.status !== task.status && patch.status === "done") {
    await logActivity(db, { ownerId: userId, dealId, type: "task.done", message: `Completed task "${row.title}".` });
  }
  return row;
}

export async function deleteTask(db: DpDb, userId: string, dealId: string, taskId: string) {
  const task = await getOwnedTask(db, userId, dealId, taskId);
  await db.delete(dpDueDiligenceTask).where(eq(dpDueDiligenceTask.id, task.id));
}

/** Inserts generated checklist items, skipping ones already on the deal. Returns how many were added. */
export async function generateTasksForDeal(db: DpDb, ctx: DealContext): Promise<number> {
  const generated = generateDueDiligenceTasks(ctx.analyst.property, ctx.assumptions);
  if (generated.length === 0) return 0;
  const inserted = await db
    .insert(dpDueDiligenceTask)
    .values(generated.map((t) => ({ dealId: ctx.deal.id, generatedKey: t.key, title: t.title, category: t.category, detail: t.detail, priority: t.priority, source: "workflow" })))
    .onConflictDoNothing({ target: [dpDueDiligenceTask.dealId, dpDueDiligenceTask.generatedKey] })
    .returning({ id: dpDueDiligenceTask.id });
  return inserted.length;
}
