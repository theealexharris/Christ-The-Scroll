import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  dpActivityEvent,
  dpAiMessage,
  dpDeal,
  dpDealAssumption,
  dpDueDiligenceTask,
  dpFinancingScenario,
  dpGeneratedDocument,
  dpOfferDraft,
  dpProperty,
  dpPropertySourceRecord,
  dpSavedSearch,
  dpUnderwritingResult,
  dpUser,
  dpWorkflowRun,
  dpWorkflowStep,
  type DpDb,
} from "@workspace/dealpilot-db";
import { listActivity } from "./activity";
import { listDeals } from "./deals";
import { getPreferences } from "./preferences";

/** Everything stored for a user, as JSON (data portability). */
export async function exportUserData(db: DpDb, userId: string) {
  const [user] = await db.select({ id: dpUser.id, name: dpUser.name, email: dpUser.email, createdAt: dpUser.createdAt, isAnonymous: dpUser.isAnonymous }).from(dpUser).where(eq(dpUser.id, userId));
  const properties = await db.select().from(dpProperty).where(eq(dpProperty.ownerId, userId));
  const propertyIds = properties.map((p) => p.id);
  const deals = await db.select().from(dpDeal).where(eq(dpDeal.ownerId, userId));
  const dealIds = deals.map((d) => d.id);
  const byDeal = <T>(rows: Promise<T[]>) => (dealIds.length ? rows : Promise.resolve([] as T[]));
  const runs = await byDeal(db.select().from(dpWorkflowRun).where(inArray(dpWorkflowRun.dealId, dealIds)));
  return {
    exportedAt: new Date().toISOString(),
    user,
    preferences: await getPreferences(db, userId),
    properties,
    propertySources: propertyIds.length ? await db.select().from(dpPropertySourceRecord).where(inArray(dpPropertySourceRecord.propertyId, propertyIds)) : [],
    deals,
    assumptions: await byDeal(db.select().from(dpDealAssumption).where(inArray(dpDealAssumption.dealId, dealIds))),
    underwritingResults: await byDeal(db.select().from(dpUnderwritingResult).where(inArray(dpUnderwritingResult.dealId, dealIds))),
    financingScenarios: await byDeal(db.select().from(dpFinancingScenario).where(inArray(dpFinancingScenario.dealId, dealIds))),
    workflowRuns: runs,
    workflowSteps: runs.length ? await db.select().from(dpWorkflowStep).where(inArray(dpWorkflowStep.runId, runs.map((r) => r.id))) : [],
    aiMessages: await byDeal(db.select().from(dpAiMessage).where(inArray(dpAiMessage.dealId, dealIds))),
    tasks: await byDeal(db.select().from(dpDueDiligenceTask).where(inArray(dpDueDiligenceTask.dealId, dealIds))),
    offerDrafts: await byDeal(db.select().from(dpOfferDraft).where(inArray(dpOfferDraft.dealId, dealIds))),
    documents: await db
      .select({ id: dpGeneratedDocument.id, dealId: dpGeneratedDocument.dealId, kind: dpGeneratedDocument.kind, format: dpGeneratedDocument.format, title: dpGeneratedDocument.title, createdAt: dpGeneratedDocument.createdAt })
      .from(dpGeneratedDocument)
      .where(eq(dpGeneratedDocument.ownerId, userId)),
    savedSearches: await db.select().from(dpSavedSearch).where(eq(dpSavedSearch.ownerId, userId)),
    activity: await db.select().from(dpActivityEvent).where(eq(dpActivityEvent.ownerId, userId)).orderBy(desc(dpActivityEvent.createdAt)),
  };
}

/** Permanently deletes the user. Foreign keys cascade to every owned row. */
export async function deleteUserAccount(db: DpDb, userId: string) {
  await db.transaction(async (tx) => {
    // Deals restrict property deletion, so remove them first.
    await tx.delete(dpDeal).where(eq(dpDeal.ownerId, userId));
    await tx.delete(dpUser).where(eq(dpUser.id, userId));
  });
}

export async function dashboardSummary(db: DpDb, userId: string) {
  const deals = await listDeals(db, userId);
  const stageCounts: Record<string, number> = {};
  for (const d of deals) stageCounts[d.stage] = (stageCounts[d.stage] ?? 0) + 1;
  const dealIds = deals.map((d) => d.id);
  const activeRuns = dealIds.length
    ? await db
        .select({ id: dpWorkflowRun.id, dealId: dpWorkflowRun.dealId, status: dpWorkflowRun.status, updatedAt: dpWorkflowRun.updatedAt })
        .from(dpWorkflowRun)
        .where(and(inArray(dpWorkflowRun.dealId, dealIds), inArray(dpWorkflowRun.status, ["queued", "running", "needs_input", "needs_review", "failed"])))
        .orderBy(desc(dpWorkflowRun.updatedAt))
        .limit(20)
    : [];
  // Only the latest run per deal matters for "active analyses".
  const latestByDeal = new Map<string, (typeof activeRuns)[number]>();
  for (const r of activeRuns) if (!latestByDeal.has(r.dealId)) latestByDeal.set(r.dealId, r);
  const [{ drafts }] = dealIds.length
    ? await db.select({ drafts: count() }).from(dpOfferDraft).where(inArray(dpOfferDraft.dealId, dealIds))
    : [{ drafts: 0 }];
  const [{ openTasks }] = dealIds.length
    ? await db.select({ openTasks: count() }).from(dpDueDiligenceTask).where(and(inArray(dpDueDiligenceTask.dealId, dealIds), inArray(dpDueDiligenceTask.status, ["open", "in_progress"])))
    : [{ openTasks: 0 }];
  const [{ ownProperties }] = await db.select({ ownProperties: count() }).from(dpProperty).where(and(eq(dpProperty.ownerId, userId), isNull(dpProperty.archivedAt)));
  return {
    savedDeals: deals.length,
    sampleDeals: deals.filter((d) => d.property.isSample).length,
    stageCounts,
    activeAnalyses: Array.from(latestByDeal.values()).map((r) => ({ ...r, dealName: deals.find((d) => d.id === r.dealId)?.name ?? "" })),
    draftOffers: drafts,
    openTasks,
    ownProperties,
    recentDeals: deals.slice(0, 5),
    recentActivity: await listActivity(db, userId, { limit: 10 }),
  };
}
