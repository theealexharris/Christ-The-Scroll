import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import {
  AiChatInputSchema,
  BRAND,
  CSV_MAX_ROWS,
  CSV_TEMPLATE,
  DealAssumptionsSchema,
  DealCreateSchema,
  DealUpdateSchema,
  FinancingParamsSchema,
  mapCsvToProperties,
  OfferDraftInputSchema,
  OFFER_REVIEW_CHECKLIST,
  PreferencesSchema,
  PropertyInputSchema,
  PropertySearchSchema,
  PropertyUpdateSchema,
  SavedSearchInputSchema,
  TaskInputSchema,
  TaskUpdateSchema,
  findEvidenceGaps,
} from "@workspace/dealpilot-core";
import { dpSavedSearch, type DpDb } from "@workspace/dealpilot-db";
import type { AppConfig } from "../config";
import { requireUser, userId } from "../lib/auth";
import { HttpError, notFound, parseOrThrow, uuidParam } from "../lib/http";
import { aiRateLimiter, importRateLimiter } from "../lib/security";
import { AnalystError, type AnalystProvider } from "../llm/provider";
import { dashboardSummary, deleteUserAccount, exportUserData } from "../services/account";
import { listActivity } from "../services/activity";
import { askQuestion, createReview, listAiMessages } from "../services/ai";
import {
  createDeal,
  createScenario,
  deleteScenario,
  getDealContext,
  getOwnedDeal,
  listDeals,
  saveAssumptions,
  setDealArchived,
  underwritingHistory,
  updateDeal,
  updateScenario,
} from "../services/deals";
import { createOfferDocument, createReportDocument, getOwnedDocument, listDocuments, renderDocument } from "../services/documents";
import { integrationStatuses } from "../services/integrations";
import { createOfferDraft, listOfferDrafts, suggestedOfferTerms } from "../services/offers";
import { getPreferences, savePreferences } from "../services/preferences";
import { createProperty, getVisibleProperty, importProperties, searchProperties, setPropertyArchived, updateProperty } from "../services/properties";
import { createTask, deleteTask, listTasks, updateTask } from "../services/tasks";
import { approveWorkflow, getRun, listRuns, retryWorkflow, startWorkflow } from "../services/workflow";

export type RouteDeps = { db: DpDb; config: AppConfig; analyst: AnalystProvider };

const FormatSchema = z.object({ format: z.enum(["pdf", "docx"]).default("pdf") });
const ImportSchema = z.object({ csv: z.string().min(1, "Paste or upload CSV text").max(1_000_000), dryRun: z.boolean().default(false) });

async function checkDatabase(db: DpDb): Promise<{ databaseOk: boolean; databaseError?: string }> {
  try {
    await db.execute(sql`select 1`);
    return { databaseOk: true };
  } catch (err) {
    return { databaseOk: false, databaseError: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
}

function aiError(err: unknown): never {
  if (err instanceof AnalystError) throw new HttpError(err.retryable ? 503 : 502, err.message);
  throw err;
}

export function createApiRouter({ db, config, analyst }: RouteDeps): Router {
  const router = Router();
  const aiLimiter = aiRateLimiter(config);

  // ---- Public --------------------------------------------------------------
  router.get("/health", async (_req, res) => {
    const health = await checkDatabase(db);
    res.status(health.databaseOk ? 200 : 503).json({ status: health.databaseOk ? "ok" : "degraded", database: health.databaseOk ? "ok" : "error", time: new Date().toISOString() });
  });

  router.get("/meta", (req, res) => {
    res.json({
      brand: BRAND,
      aiMode: analyst.mode,
      aiModel: analyst.model,
      allowDemoAccounts: config.allowDemoAccounts,
      signedIn: !!req.user,
    });
  });

  router.get("/me", (req, res) => {
    res.json({ user: req.user ?? null });
  });

  // Everything below requires a session.
  router.use(requireUser);

  router.get("/integrations/status", async (_req, res) => {
    res.json({ integrations: integrationStatuses(config, await checkDatabase(db)) });
  });

  router.get("/dashboard", async (req, res) => {
    res.json(await dashboardSummary(db, userId(req)));
  });

  router.get("/activity", async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(200).default(50).parse(req.query.limit ?? 50);
    res.json({ items: await listActivity(db, userId(req), { limit }) });
  });

  // ---- Preferences & account ----------------------------------------------
  router.get("/preferences", async (req, res) => {
    res.json(await getPreferences(db, userId(req)));
  });
  router.put("/preferences", async (req, res) => {
    res.json(await savePreferences(db, userId(req), parseOrThrow(PreferencesSchema, req.body)));
  });
  router.get("/account/export", async (req, res) => {
    res.setHeader("Content-Disposition", `attachment; filename="dealpilot-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(await exportUserData(db, userId(req)));
  });
  router.delete("/account", async (req, res) => {
    const { confirm } = parseOrThrow(z.object({ confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm' }) }) }), req.body);
    void confirm;
    await deleteUserAccount(db, userId(req));
    res.status(204).end();
  });

  // ---- Properties -----------------------------------------------------------
  router.get("/properties", async (req, res) => {
    res.json(await searchProperties(db, userId(req), parseOrThrow(PropertySearchSchema, req.query)));
  });
  router.post("/properties", async (req, res) => {
    res.status(201).json(await createProperty(db, userId(req), parseOrThrow(PropertyInputSchema, req.body)));
  });
  router.get("/properties/import/template", (_req, res) => {
    res.type("text/csv").setHeader("Content-Disposition", 'attachment; filename="dealpilot-import-template.csv"');
    res.send(CSV_TEMPLATE);
  });
  router.post("/properties/import", importRateLimiter(), async (req, res) => {
    const { csv, dryRun } = parseOrThrow(ImportSchema, req.body);
    const mapped = mapCsvToProperties(csv);
    const created = dryRun || mapped.valid.length === 0 ? [] : await importProperties(db, userId(req), mapped.valid);
    res.status(dryRun ? 200 : 201).json({ dryRun, maxRows: CSV_MAX_ROWS, validCount: mapped.valid.length, createdIds: created, errors: mapped.errors, unknownHeaders: mapped.unknownHeaders });
  });
  router.get("/properties/:propertyId", async (req, res) => {
    res.json(await getVisibleProperty(db, userId(req), uuidParam(req, "propertyId", "Property")));
  });
  router.patch("/properties/:propertyId", async (req, res) => {
    res.json(await updateProperty(db, userId(req), uuidParam(req, "propertyId", "Property"), parseOrThrow(PropertyUpdateSchema, req.body)));
  });
  router.post("/properties/:propertyId/archive", async (req, res) => {
    res.json(await setPropertyArchived(db, userId(req), uuidParam(req, "propertyId", "Property"), true));
  });
  router.post("/properties/:propertyId/restore", async (req, res) => {
    res.json(await setPropertyArchived(db, userId(req), uuidParam(req, "propertyId", "Property"), false));
  });

  // ---- Saved searches -----------------------------------------------------
  router.get("/saved-searches", async (req, res) => {
    res.json({ items: await db.select().from(dpSavedSearch).where(eq(dpSavedSearch.ownerId, userId(req))).orderBy(desc(dpSavedSearch.createdAt)) });
  });
  router.post("/saved-searches", async (req, res) => {
    const input = parseOrThrow(SavedSearchInputSchema, req.body);
    const [row] = await db.insert(dpSavedSearch).values({ ownerId: userId(req), name: input.name, filters: input.filters }).returning();
    res.status(201).json(row);
  });
  router.delete("/saved-searches/:searchId", async (req, res) => {
    const deleted = await db
      .delete(dpSavedSearch)
      .where(and(eq(dpSavedSearch.id, uuidParam(req, "searchId", "Saved search")), eq(dpSavedSearch.ownerId, userId(req))))
      .returning({ id: dpSavedSearch.id });
    if (deleted.length === 0) throw notFound("Saved search");
    res.status(204).end();
  });

  // ---- Deals ----------------------------------------------------------------
  const dealId = (req: Request) => uuidParam(req, "id", "Deal");
  // Ownership is checked before body validation so other users' deals always look absent.
  router.param("id", async (req, _res, next) => {
    try {
      await getOwnedDeal(db, userId(req), dealId(req));
      next();
    } catch (err) {
      next(err);
    }
  });

  router.get("/deals", async (req, res) => {
    const q = parseOrThrow(z.object({ archived: z.enum(["true", "false"]).optional(), stage: z.string().max(40).optional() }), req.query);
    res.json({ items: await listDeals(db, userId(req), { archived: q.archived === "true", stage: q.stage }) });
  });
  router.post("/deals", async (req, res) => {
    res.status(201).json(await createDeal(db, userId(req), parseOrThrow(DealCreateSchema, req.body)));
  });
  router.get("/deals/:id", async (req, res) => {
    const ctx = await getDealContext(db, userId(req), dealId(req));
    res.json({
      deal: ctx.deal,
      property: ctx.property,
      assumptionVersion: ctx.assumptionVersion,
      assumptions: ctx.assumptions,
      underwriting: ctx.analyst.underwriting,
      scenarios: ctx.scenarios,
      evidenceGaps: findEvidenceGaps(ctx.analyst.property, ctx.assumptions),
    });
  });
  router.patch("/deals/:id", async (req, res) => {
    res.json(await updateDeal(db, userId(req), dealId(req), parseOrThrow(DealUpdateSchema, req.body)));
  });
  router.post("/deals/:id/archive", async (req, res) => {
    res.json(await setDealArchived(db, userId(req), dealId(req), true));
  });
  router.post("/deals/:id/restore", async (req, res) => {
    res.json(await setDealArchived(db, userId(req), dealId(req), false));
  });
  router.put("/deals/:id/assumptions", async (req, res) => {
    res.json(await saveAssumptions(db, userId(req), dealId(req), parseOrThrow(DealAssumptionsSchema, req.body)));
  });
  router.get("/deals/:id/underwriting", async (req, res) => {
    res.json({ items: await underwritingHistory(db, userId(req), dealId(req)) });
  });
  router.get("/deals/:id/activity", async (req, res) => {
    await getDealContext(db, userId(req), dealId(req));
    res.json({ items: await listActivity(db, userId(req), { dealId: dealId(req), limit: 100 }) });
  });

  // ---- Financing scenarios --------------------------------------------------
  router.get("/deals/:id/financing-scenarios", async (req, res) => {
    const ctx = await getDealContext(db, userId(req), dealId(req));
    res.json({ items: ctx.scenarios });
  });
  router.post("/deals/:id/financing-scenarios", async (req, res) => {
    res.status(201).json(await createScenario(db, userId(req), dealId(req), parseOrThrow(FinancingParamsSchema, req.body)));
  });
  router.put("/deals/:id/financing-scenarios/:scenarioId", async (req, res) => {
    res.json(await updateScenario(db, userId(req), dealId(req), uuidParam(req, "scenarioId", "Financing scenario"), parseOrThrow(FinancingParamsSchema, req.body)));
  });
  router.delete("/deals/:id/financing-scenarios/:scenarioId", async (req, res) => {
    await deleteScenario(db, userId(req), dealId(req), uuidParam(req, "scenarioId", "Financing scenario"));
    res.status(204).end();
  });

  // ---- AI analyst -----------------------------------------------------------
  router.get("/deals/:id/ai-messages", async (req, res) => {
    await getDealContext(db, userId(req), dealId(req));
    res.json({ mode: analyst.mode, model: analyst.model, items: await listAiMessages(db, dealId(req)) });
  });
  router.post("/deals/:id/ai-review", aiLimiter, async (req, res) => {
    const ctx = await getDealContext(db, userId(req), dealId(req));
    const row = await createReview(db, analyst, ctx, userId(req)).catch(aiError);
    res.status(201).json(row);
  });
  router.post("/deals/:id/ai-chat", aiLimiter, async (req, res) => {
    const { question } = parseOrThrow(AiChatInputSchema, req.body);
    const ctx = await getDealContext(db, userId(req), dealId(req));
    res.status(201).json(await askQuestion(db, analyst, ctx, question).catch(aiError));
  });

  // ---- Workflow -------------------------------------------------------------
  router.post("/deals/:id/analyze", aiLimiter, async (req, res) => {
    res.status(201).json(await startWorkflow(db, analyst, userId(req), dealId(req)));
  });
  router.get("/deals/:id/workflow-runs", async (req, res) => {
    res.json({ items: await listRuns(db, userId(req), dealId(req)) });
  });
  router.get("/workflow-runs/:runId", async (req, res) => {
    res.json(await getRun(db, userId(req), uuidParam(req, "runId", "Workflow run")));
  });
  router.post("/workflow-runs/:runId/retry", aiLimiter, async (req, res) => {
    res.json(await retryWorkflow(db, analyst, userId(req), uuidParam(req, "runId", "Workflow run")));
  });
  router.post("/workflow-runs/:runId/approve", async (req, res) => {
    res.json(await approveWorkflow(db, userId(req), uuidParam(req, "runId", "Workflow run")));
  });

  // ---- Due-diligence tasks ---------------------------------------------------
  router.get("/deals/:id/tasks", async (req, res) => {
    res.json({ items: await listTasks(db, userId(req), dealId(req)) });
  });
  router.post("/deals/:id/tasks", async (req, res) => {
    res.status(201).json(await createTask(db, userId(req), dealId(req), parseOrThrow(TaskInputSchema, req.body)));
  });
  router.patch("/deals/:id/tasks/:taskId", async (req, res) => {
    res.json(await updateTask(db, userId(req), dealId(req), uuidParam(req, "taskId", "Task"), parseOrThrow(TaskUpdateSchema, req.body)));
  });
  router.delete("/deals/:id/tasks/:taskId", async (req, res) => {
    await deleteTask(db, userId(req), dealId(req), uuidParam(req, "taskId", "Task"));
    res.status(204).end();
  });

  // ---- Offers & documents ---------------------------------------------------
  router.get("/deals/:id/offer-drafts", async (req, res) => {
    const id = dealId(req);
    const items = await listOfferDrafts(db, userId(req), id);
    res.json({ items, checklist: OFFER_REVIEW_CHECKLIST, suggestedTerms: items.length === 0 ? await suggestedOfferTerms(db, userId(req), id) : null });
  });
  router.post("/deals/:id/offer-drafts", async (req, res) => {
    res.status(201).json(await createOfferDraft(db, userId(req), dealId(req), parseOrThrow(OfferDraftInputSchema, req.body)));
  });
  router.post("/offer-drafts/:draftId/documents", async (req, res) => {
    const { format } = parseOrThrow(FormatSchema, req.body ?? {});
    res.status(201).json(await createOfferDocument(db, userId(req), uuidParam(req, "draftId", "Offer draft"), format));
  });
  router.get("/deals/:id/documents", async (req, res) => {
    res.json({ items: await listDocuments(db, userId(req), dealId(req)) });
  });
  router.post("/deals/:id/reports", async (req, res) => {
    const { format } = parseOrThrow(FormatSchema, req.body ?? {});
    res.status(201).json(await createReportDocument(db, userId(req), dealId(req), format));
  });
  router.get("/documents/:docId", async (req, res) => {
    const doc = await getOwnedDocument(db, userId(req), uuidParam(req, "docId", "Document"));
    res.json({ id: doc.id, kind: doc.kind, format: doc.format, title: doc.title, dealId: doc.dealId, createdAt: doc.createdAt, snapshot: doc.snapshot });
  });
  router.get("/documents/:docId/download", async (req, res) => {
    const doc = await getOwnedDocument(db, userId(req), uuidParam(req, "docId", "Document"));
    const file = await renderDocument(doc);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.body);
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "API route not found." });
  });

  return router;
}
