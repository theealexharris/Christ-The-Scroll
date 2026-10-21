import { and, asc, desc, eq, isNotNull, isNull, max, type SQL } from "drizzle-orm";
import {
  computeFinancingScenario,
  computeUnderwriting,
  DealAssumptionsSchema,
  defaultAssumptions,
  defaultFinancingParams,
  FinancingParamsSchema,
  type AnalystContext,
  type DealAssumptions,
  type FinancingParams,
  type FinancingResult,
} from "@workspace/dealpilot-core";
import {
  dpDeal,
  dpDealAssumption,
  dpFinancingScenario,
  dpProperty,
  dpUnderwritingResult,
  type DpDb,
  type DpDeal,
  type DpFinancingScenario,
} from "@workspace/dealpilot-db";
import { notFound } from "../lib/http";
import { logActivity } from "./activity";
import { getPreferences } from "./preferences";
import { cloneSampleForUser, getVisibleProperty, toFacts, type PropertyDto } from "./properties";

export const ENGINE_VERSION = "1.0.0";

export async function getOwnedDeal(db: DpDb, userId: string, dealId: string): Promise<DpDeal> {
  const [deal] = await db.select().from(dpDeal).where(and(eq(dpDeal.id, dealId), eq(dpDeal.ownerId, userId)));
  if (!deal) throw notFound("Deal");
  return deal;
}

export async function listDeals(db: DpDb, userId: string, options: { archived?: boolean; stage?: string } = {}) {
  const conditions: SQL[] = [eq(dpDeal.ownerId, userId), options.archived ? isNotNull(dpDeal.archivedAt) : isNull(dpDeal.archivedAt)];
  if (options.stage) conditions.push(eq(dpDeal.stage, options.stage));
  const rows = await db
    .select({ deal: dpDeal, property: dpProperty })
    .from(dpDeal)
    .innerJoin(dpProperty, eq(dpDeal.propertyId, dpProperty.id))
    .where(and(...conditions))
    .orderBy(desc(dpDeal.updatedAt));
  // Attach headline metrics from current assumptions so the pipeline can show them.
  return Promise.all(
    rows.map(async ({ deal, property }) => {
      const current = await currentAssumptions(db, deal.id);
      const uw = current ? computeUnderwriting(current.assumptions) : null;
      return {
        ...deal,
        property: {
          id: property.id,
          title: property.title,
          addressLine: property.addressLine,
          city: property.city,
          state: property.state,
          category: property.category,
          propertyType: property.propertyType,
          sourceStatus: property.sourceStatus,
          isSample: property.isSample,
          listPrice: property.listPrice,
        },
        headline: uw
          ? {
              purchasePrice: uw.acquisition.purchasePrice,
              monthlyCashFlow: uw.cashFlow.monthly,
              capRatePct: uw.metrics.capRatePct,
              cashOnCashPct: uw.metrics.cashOnCashPct,
              dscr: uw.metrics.dscr,
            }
          : null,
      };
    }),
  );
}

export async function currentAssumptions(db: DpDb, dealId: string): Promise<{ version: number; assumptions: DealAssumptions } | null> {
  const [row] = await db.select().from(dpDealAssumption).where(eq(dpDealAssumption.dealId, dealId)).orderBy(desc(dpDealAssumption.version)).limit(1);
  if (!row) return null;
  const parsed = DealAssumptionsSchema.safeParse(row.assumptions);
  return parsed.success ? { version: row.version, assumptions: parsed.data } : null;
}

export async function createDeal(db: DpDb, userId: string, input: { propertyId: string; name?: string }) {
  const visible = await getVisibleProperty(db, userId, input.propertyId);
  const property = visible.ownerId === null ? await cloneSampleForUser(db, userId, visible) : visible;
  const prefs = await getPreferences(db, userId);
  const assumptions = defaultAssumptions({
    listPrice: property.listPrice,
    estimatedRentMonthly: property.estimatedRentMonthly,
    annualTaxes: property.annualTaxes,
    propertyType: property.propertyType,
    preferences: prefs,
  });
  const deal = await db.transaction(async (tx) => {
    const [d] = await tx
      .insert(dpDeal)
      .values({ ownerId: userId, propertyId: property.id, name: input.name ?? property.title, stage: "analyzing" })
      .returning();
    await tx.insert(dpDealAssumption).values({ dealId: d.id, version: 1, assumptions });
    await tx.insert(dpUnderwritingResult).values({
      dealId: d.id,
      assumptionVersion: 1,
      inputs: assumptions,
      outputs: computeUnderwriting(assumptions),
      engineVersion: ENGINE_VERSION,
    });
    const kinds = assumptions.useFinancing ? (["cash", "conventional"] as const) : (["cash"] as const);
    for (const kind of kinds) {
      const params = defaultFinancingParams(kind, assumptions);
      await tx.insert(dpFinancingScenario).values({ dealId: d.id, kind, name: params.name, params });
    }
    return d;
  });
  await logActivity(db, {
    ownerId: userId,
    dealId: deal.id,
    propertyId: property.id,
    type: "deal.created",
    message: `Saved "${deal.name}" as a deal${property.isSample ? " (sample data)" : ""}.`,
  });
  return deal;
}

export async function updateDeal(db: DpDb, userId: string, dealId: string, patch: { name?: string; stage?: string; notes?: string | null }) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const [updated] = await db.update(dpDeal).set(patch).where(eq(dpDeal.id, deal.id)).returning();
  if (patch.stage && patch.stage !== deal.stage) {
    await logActivity(db, { ownerId: userId, dealId, type: "deal.stage", message: `Moved "${updated.name}" to ${patch.stage.replace("_", " ")}.` });
  }
  return updated;
}

export async function setDealArchived(db: DpDb, userId: string, dealId: string, archived: boolean) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const [updated] = await db
    .update(dpDeal)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(dpDeal.id, deal.id))
    .returning();
  await logActivity(db, { ownerId: userId, dealId, type: archived ? "deal.archived" : "deal.restored", message: `${archived ? "Archived" : "Restored"} "${deal.name}".` });
  return updated;
}

export async function saveAssumptions(db: DpDb, userId: string, dealId: string, assumptions: DealAssumptions) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const underwriting = computeUnderwriting(assumptions);
  const version = await db.transaction(async (tx) => {
    const [{ current }] = await tx.select({ current: max(dpDealAssumption.version) }).from(dpDealAssumption).where(eq(dpDealAssumption.dealId, deal.id));
    const next = (current ?? 0) + 1;
    await tx.insert(dpDealAssumption).values({ dealId: deal.id, version: next, assumptions });
    await tx.insert(dpUnderwritingResult).values({ dealId: deal.id, assumptionVersion: next, inputs: assumptions, outputs: underwriting, engineVersion: ENGINE_VERSION });
    await tx.update(dpDeal).set({ updatedAt: new Date() }).where(eq(dpDeal.id, deal.id));
    return next;
  });
  await logActivity(db, { ownerId: userId, dealId, type: "deal.assumptions", message: `Updated underwriting assumptions for "${deal.name}" (version ${version}).` });
  return { version, assumptions, underwriting };
}

export async function underwritingHistory(db: DpDb, userId: string, dealId: string) {
  await getOwnedDeal(db, userId, dealId);
  return db
    .select()
    .from(dpUnderwritingResult)
    .where(eq(dpUnderwritingResult.dealId, dealId))
    .orderBy(desc(dpUnderwritingResult.createdAt))
    .limit(50);
}

export type ScenarioWithResult = DpFinancingScenario & { params: FinancingParams; result: FinancingResult };

export async function listScenarios(db: DpDb, dealId: string, assumptions: DealAssumptions): Promise<ScenarioWithResult[]> {
  const rows = await db.select().from(dpFinancingScenario).where(eq(dpFinancingScenario.dealId, dealId)).orderBy(asc(dpFinancingScenario.createdAt));
  return rows.flatMap((row) => {
    const parsed = FinancingParamsSchema.safeParse(row.params);
    if (!parsed.success) return [];
    return [{ ...row, params: parsed.data, result: computeFinancingScenario(assumptions, parsed.data) }];
  });
}

export type DealContext = {
  deal: DpDeal;
  property: PropertyDto;
  assumptionVersion: number;
  assumptions: DealAssumptions;
  scenarios: ScenarioWithResult[];
  analyst: AnalystContext;
};

/** Loads a deal with everything needed to render or analyse it, enforcing ownership. */
export async function getDealContext(db: DpDb, userId: string, dealId: string): Promise<DealContext> {
  const deal = await getOwnedDeal(db, userId, dealId);
  const property = await getVisibleProperty(db, userId, deal.propertyId);
  const current = await currentAssumptions(db, deal.id);
  const assumptions = current?.assumptions ?? defaultAssumptions({ listPrice: property.listPrice, estimatedRentMonthly: property.estimatedRentMonthly, annualTaxes: property.annualTaxes, propertyType: property.propertyType });
  const scenarios = await listScenarios(db, deal.id, assumptions);
  const underwriting = computeUnderwriting(assumptions);
  return {
    deal,
    property,
    assumptionVersion: current?.version ?? 0,
    assumptions,
    scenarios,
    analyst: { property: toFacts(property), assumptions, underwriting, financing: scenarios.map((s) => s.result) },
  };
}

export async function createScenario(db: DpDb, userId: string, dealId: string, params: FinancingParams) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const [row] = await db.insert(dpFinancingScenario).values({ dealId: deal.id, kind: params.kind, name: params.name, params }).returning();
  await logActivity(db, { ownerId: userId, dealId, type: "financing.created", message: `Added financing scenario "${params.name}".` });
  return row;
}

async function getOwnedScenario(db: DpDb, userId: string, dealId: string, scenarioId: string) {
  await getOwnedDeal(db, userId, dealId);
  const [row] = await db.select().from(dpFinancingScenario).where(and(eq(dpFinancingScenario.id, scenarioId), eq(dpFinancingScenario.dealId, dealId)));
  if (!row) throw notFound("Financing scenario");
  return row;
}

export async function updateScenario(db: DpDb, userId: string, dealId: string, scenarioId: string, params: FinancingParams) {
  const row = await getOwnedScenario(db, userId, dealId, scenarioId);
  const [updated] = await db.update(dpFinancingScenario).set({ kind: params.kind, name: params.name, params }).where(eq(dpFinancingScenario.id, row.id)).returning();
  return updated;
}

export async function deleteScenario(db: DpDb, userId: string, dealId: string, scenarioId: string) {
  const row = await getOwnedScenario(db, userId, dealId, scenarioId);
  await db.delete(dpFinancingScenario).where(eq(dpFinancingScenario.id, row.id));
  await logActivity(db, { ownerId: userId, dealId, type: "financing.deleted", message: `Removed financing scenario "${row.name}".` });
}
