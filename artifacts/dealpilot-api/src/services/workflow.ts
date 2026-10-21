import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { findEvidenceGaps, WORKFLOW_STEPS, type WorkflowStatus, type WorkflowStepKey } from "@workspace/dealpilot-core";
import { dpDeal, dpUnderwritingResult, dpWorkflowRun, dpWorkflowStep, type DpDb } from "@workspace/dealpilot-db";
import { HttpError, notFound } from "../lib/http";
import { logger } from "../lib/logger";
import { AnalystError, type AnalystProvider } from "../llm/provider";
import { logActivity } from "./activity";
import { createReview } from "./ai";
import { ENGINE_VERSION, getDealContext, getOwnedDeal, type DealContext } from "./deals";
import { createReportDocument } from "./documents";
import { generateTasksForDeal } from "./tasks";

type StepOutcome = { status: "completed" } | { status: "waiting"; runStatus: Extract<WorkflowStatus, "needs_input" | "needs_review"> } | { status: "failed"; error: string };

export async function getRun(db: DpDb, userId: string, runId: string) {
  const [row] = await db
    .select({ run: dpWorkflowRun })
    .from(dpWorkflowRun)
    .innerJoin(dpDeal, eq(dpWorkflowRun.dealId, dpDeal.id))
    .where(and(eq(dpWorkflowRun.id, runId), eq(dpDeal.ownerId, userId)));
  if (!row) throw notFound("Workflow run");
  const steps = await db.select().from(dpWorkflowStep).where(eq(dpWorkflowStep.runId, runId)).orderBy(asc(dpWorkflowStep.position));
  return { ...row.run, steps };
}

export async function listRuns(db: DpDb, userId: string, dealId: string) {
  await getOwnedDeal(db, userId, dealId);
  const runs = await db.select().from(dpWorkflowRun).where(eq(dpWorkflowRun.dealId, dealId)).orderBy(desc(dpWorkflowRun.createdAt)).limit(20);
  if (runs.length === 0) return [];
  const steps = await db
    .select()
    .from(dpWorkflowStep)
    .where(inArray(dpWorkflowStep.runId, runs.map((r) => r.id)))
    .orderBy(asc(dpWorkflowStep.position));
  return runs.map((r) => ({ ...r, steps: steps.filter((s) => s.runId === r.id) }));
}

export async function startWorkflow(db: DpDb, analyst: AnalystProvider, userId: string, dealId: string) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const [active] = await db
    .select({ id: dpWorkflowRun.id })
    .from(dpWorkflowRun)
    .where(and(eq(dpWorkflowRun.dealId, deal.id), inArray(dpWorkflowRun.status, ["queued", "running"])));
  if (active) throw new HttpError(409, "An analysis is already running for this deal.");
  const run = await db.transaction(async (tx) => {
    const [r] = await tx.insert(dpWorkflowRun).values({ dealId: deal.id, status: "queued", aiMode: analyst.mode }).returning();
    await tx.insert(dpWorkflowStep).values(WORKFLOW_STEPS.map((s, i) => ({ runId: r.id, key: s.key, position: i, status: "pending" })));
    return r;
  });
  await logActivity(db, { ownerId: userId, dealId, type: "workflow.started", message: `Started analysis workflow for "${deal.name}".` });
  await execute(db, analyst, userId, run.id, 0);
  return getRun(db, userId, run.id);
}

export async function retryWorkflow(db: DpDb, analyst: AnalystProvider, userId: string, runId: string) {
  const run = await getRun(db, userId, runId);
  if (run.status !== "failed" && run.status !== "needs_input") throw new HttpError(409, "Only failed runs or runs waiting for input can be retried.");
  // Inputs may have changed, so a needs-input run restarts from validation; a failed run resumes at the failed step.
  const from = run.status === "needs_input" ? 0 : Math.max(0, run.steps.findIndex((s) => s.status === "failed"));
  await db
    .update(dpWorkflowStep)
    .set({ status: "pending", error: null, output: null, startedAt: null, finishedAt: null })
    .where(and(eq(dpWorkflowStep.runId, runId), inArray(dpWorkflowStep.key, WORKFLOW_STEPS.slice(from).map((s) => s.key))));
  await db.update(dpWorkflowRun).set({ attempts: run.attempts + 1, error: null, aiMode: analyst.mode, status: "queued" }).where(eq(dpWorkflowRun.id, runId));
  await execute(db, analyst, userId, runId, from);
  return getRun(db, userId, runId);
}

/** User accepts the reviewed results; the final step saves the report snapshot. */
export async function approveWorkflow(db: DpDb, userId: string, runId: string) {
  const run = await getRun(db, userId, runId);
  if (run.status !== "needs_review") throw new HttpError(409, "This run is not waiting for review.");
  const now = new Date();
  await setStep(db, runId, "present_review", { status: "completed", finishedAt: now, output: { reviewedAt: now.toISOString() } });
  await db.update(dpWorkflowRun).set({ status: "running", currentStep: "save_report" }).where(eq(dpWorkflowRun.id, runId));
  await setStep(db, runId, "save_report", { status: "running", startedAt: now });
  try {
    const doc = await createReportDocument(db, userId, run.dealId, "pdf");
    await setStep(db, runId, "save_report", { status: "completed", finishedAt: new Date(), output: { documentId: doc.id, title: doc.title } });
    await db.update(dpWorkflowRun).set({ status: "completed", currentStep: null, finishedAt: new Date() }).where(eq(dpWorkflowRun.id, runId));
    await logActivity(db, { ownerId: userId, dealId: run.dealId, type: "workflow.completed", message: "Analysis reviewed and report saved." });
  } catch (err) {
    logger.error({ err }, "save_report failed");
    await setStep(db, runId, "save_report", { status: "failed", finishedAt: new Date(), error: "Could not save the report." });
    await db.update(dpWorkflowRun).set({ status: "failed", error: "Could not save the report." }).where(eq(dpWorkflowRun.id, runId));
  }
  return getRun(db, userId, runId);
}

async function setStep(db: DpDb, runId: string, key: WorkflowStepKey, patch: Partial<typeof dpWorkflowStep.$inferInsert>) {
  await db
    .update(dpWorkflowStep)
    .set(patch)
    .where(and(eq(dpWorkflowStep.runId, runId), eq(dpWorkflowStep.key, key)));
}

async function execute(db: DpDb, analyst: AnalystProvider, userId: string, runId: string, fromIndex: number) {
  await db.update(dpWorkflowRun).set({ status: "running", startedAt: new Date(), finishedAt: null }).where(eq(dpWorkflowRun.id, runId));
  const [{ dealId }] = await db.select({ dealId: dpWorkflowRun.dealId }).from(dpWorkflowRun).where(eq(dpWorkflowRun.id, runId));
  let ctx: DealContext | null = null;

  for (const step of WORKFLOW_STEPS.slice(fromIndex)) {
    if (step.key === "save_report") break; // runs only after the user approves
    await db.update(dpWorkflowRun).set({ currentStep: step.key }).where(eq(dpWorkflowRun.id, runId));
    await setStep(db, runId, step.key, { status: "running", startedAt: new Date() });
    let outcome: StepOutcome;
    let output: unknown = null;
    try {
      ctx ??= await getDealContext(db, userId, dealId);
      const result = await runStep(db, analyst, userId, runId, step.key, ctx);
      outcome = result.outcome;
      output = result.output;
    } catch (err) {
      const message = err instanceof AnalystError ? err.message : "Unexpected error while running this step.";
      if (!(err instanceof AnalystError)) logger.error({ err, step: step.key }, "Workflow step failed");
      outcome = { status: "failed", error: message };
    }
    const finishedAt = new Date();
    if (outcome.status === "completed") {
      await setStep(db, runId, step.key, { status: "completed", output, finishedAt });
      continue;
    }
    if (outcome.status === "waiting") {
      await setStep(db, runId, step.key, { status: "waiting", output });
      await db.update(dpWorkflowRun).set({ status: outcome.runStatus }).where(eq(dpWorkflowRun.id, runId));
      return;
    }
    await setStep(db, runId, step.key, { status: "failed", error: outcome.error, output, finishedAt });
    await db.update(dpWorkflowRun).set({ status: "failed", error: outcome.error, finishedAt }).where(eq(dpWorkflowRun.id, runId));
    await logActivity(db, { ownerId: userId, dealId, type: "workflow.failed", message: `Analysis failed at "${step.label}": ${outcome.error}` });
    return;
  }
}

async function runStep(
  db: DpDb,
  analyst: AnalystProvider,
  userId: string,
  runId: string,
  key: WorkflowStepKey,
  ctx: DealContext,
): Promise<{ outcome: StepOutcome; output: unknown }> {
  const done = (output: unknown) => ({ outcome: { status: "completed" } as const, output });
  switch (key) {
    case "validate_inputs": {
      const blocking = ctx.analyst.underwriting.warnings.filter((w) => w.severity === "error");
      if (blocking.length > 0) {
        return {
          outcome: { status: "waiting", runStatus: "needs_input" },
          output: { missing: blocking.map((w) => ({ field: w.field ?? null, message: w.message })) },
        };
      }
      return done({ checked: Object.keys(ctx.assumptions).length, warnings: ctx.analyst.underwriting.warnings.length });
    }
    case "gather_sources":
      return done({
        sources: ctx.property.sources.map((s) => ({ status: s.sourceStatus, name: s.sourceName, url: s.sourceUrl, retrievedAt: s.retrievedAt })),
        liveProviders: [],
        note: "No live property-data providers are configured, so the analysis uses the user-supplied and sample data shown. Nothing was fetched from external sites.",
      });
    case "run_calculations": {
      const [snap] = await db
        .insert(dpUnderwritingResult)
        .values({ dealId: ctx.deal.id, assumptionVersion: ctx.assumptionVersion, inputs: ctx.assumptions, outputs: ctx.analyst.underwriting, engineVersion: ENGINE_VERSION })
        .returning({ id: dpUnderwritingResult.id });
      await db.update(dpWorkflowRun).set({ underwritingResultId: snap.id }).where(eq(dpWorkflowRun.id, runId));
      const u = ctx.analyst.underwriting;
      return done({ underwritingResultId: snap.id, monthlyCashFlow: u.cashFlow.monthly, capRatePct: u.metrics.capRatePct, cashOnCashPct: u.metrics.cashOnCashPct, dscr: u.metrics.dscr });
    }
    case "ai_explanation": {
      const msg = await createReview(db, analyst, ctx, userId, runId);
      return done({ mode: analyst.mode, provider: analyst.provider, model: analyst.model, aiMessageId: msg.id });
    }
    case "flag_missing_evidence": {
      const gaps = findEvidenceGaps(ctx.analyst.property, ctx.assumptions);
      return done({ count: gaps.length, gaps: gaps.map((g) => ({ item: g.item, priority: g.priority })) });
    }
    case "create_tasks":
      return done({ added: await generateTasksForDeal(db, ctx) });
    case "present_review":
      return { outcome: { status: "waiting", runStatus: "needs_review" }, output: { message: "Review the results, AI explanation and tasks, then approve to save the report." } };
    case "save_report":
      return done(null);
  }
}
