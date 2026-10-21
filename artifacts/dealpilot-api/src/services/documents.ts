import { and, desc, eq } from "drizzle-orm";
import { AiReviewSchema, findEvidenceGaps, OfferTermsSchema } from "@workspace/dealpilot-core";
import { dpAiMessage, dpGeneratedDocument, type DpDb } from "@workspace/dealpilot-db";
import { buildDocModel, type DocumentSnapshot, type InvestmentReportSnapshot, type OfferDraftSnapshot } from "../documents/model";
import { renderDocx, renderPdf } from "../documents/render";
import { notFound } from "../lib/http";
import { logActivity } from "./activity";
import { getDealContext, getOwnedDeal } from "./deals";
import { getOwnedOfferDraft } from "./offers";
import { listTasks } from "./tasks";

export type DocFormat = "pdf" | "docx";

export async function buildReportSnapshot(db: DpDb, userId: string, dealId: string): Promise<InvestmentReportSnapshot> {
  const ctx = await getDealContext(db, userId, dealId);
  const [latestReview] = await db
    .select()
    .from(dpAiMessage)
    .where(and(eq(dpAiMessage.dealId, dealId), eq(dpAiMessage.kind, "review")))
    .orderBy(desc(dpAiMessage.createdAt))
    .limit(1);
  const parsedReview = latestReview ? AiReviewSchema.safeParse(latestReview.content) : null;
  const tasks = await listTasks(db, userId, dealId);
  return {
    kind: "investment_report",
    generatedAt: new Date().toISOString(),
    dealName: ctx.deal.name,
    property: ctx.analyst.property,
    assumptionVersion: ctx.assumptionVersion,
    assumptions: ctx.assumptions,
    underwriting: ctx.analyst.underwriting,
    financing: ctx.analyst.financing,
    review:
      latestReview && parsedReview?.success
        ? { mode: latestReview.mode, model: latestReview.model, createdAt: latestReview.createdAt.toISOString(), content: parsedReview.data }
        : null,
    evidenceGaps: findEvidenceGaps(ctx.analyst.property, ctx.assumptions),
    tasks: tasks.map((t) => ({ title: t.title, category: t.category, status: t.status, priority: t.priority })),
  };
}

export async function createReportDocument(db: DpDb, userId: string, dealId: string, format: DocFormat) {
  const snapshot = await buildReportSnapshot(db, userId, dealId);
  const [row] = await db
    .insert(dpGeneratedDocument)
    .values({ ownerId: userId, dealId, kind: "investment_report", format, title: `Investment report — ${snapshot.dealName}`, snapshot })
    .returning();
  await logActivity(db, { ownerId: userId, dealId, type: "document.report", message: `Generated a ${format.toUpperCase()} investment report for "${snapshot.dealName}".` });
  return row;
}

export async function createOfferDocument(db: DpDb, userId: string, draftId: string, format: DocFormat) {
  const { draft, deal } = await getOwnedOfferDraft(db, userId, draftId);
  const ctx = await getDealContext(db, userId, deal.id);
  const snapshot: OfferDraftSnapshot = {
    kind: "offer_draft",
    generatedAt: new Date().toISOString(),
    dealName: deal.name,
    isSample: ctx.property.isSample,
    version: draft.version,
    terms: OfferTermsSchema.parse(draft.terms),
    checklist: (draft.checklist ?? {}) as Record<string, boolean>,
  };
  const [row] = await db
    .insert(dpGeneratedDocument)
    .values({ ownerId: userId, dealId: deal.id, kind: "offer_draft", format, offerDraftId: draft.id, title: `Offer draft v${draft.version} — ${deal.name}`, snapshot })
    .returning();
  await logActivity(db, { ownerId: userId, dealId: deal.id, type: "document.offer", message: `Exported offer draft v${draft.version} as ${format.toUpperCase()} (draft only).` });
  return row;
}

export async function listDocuments(db: DpDb, userId: string, dealId: string) {
  await getOwnedDeal(db, userId, dealId);
  return db
    .select({
      id: dpGeneratedDocument.id,
      kind: dpGeneratedDocument.kind,
      format: dpGeneratedDocument.format,
      title: dpGeneratedDocument.title,
      offerDraftId: dpGeneratedDocument.offerDraftId,
      createdAt: dpGeneratedDocument.createdAt,
    })
    .from(dpGeneratedDocument)
    .where(and(eq(dpGeneratedDocument.dealId, dealId), eq(dpGeneratedDocument.ownerId, userId)))
    .orderBy(desc(dpGeneratedDocument.createdAt));
}

export async function getOwnedDocument(db: DpDb, userId: string, id: string) {
  const [row] = await db.select().from(dpGeneratedDocument).where(and(eq(dpGeneratedDocument.id, id), eq(dpGeneratedDocument.ownerId, userId)));
  if (!row) throw notFound("Document");
  return row;
}

export async function renderDocument(doc: { format: string; title: string; snapshot: unknown }) {
  const model = buildDocModel(doc.snapshot as DocumentSnapshot);
  const safeName = doc.title.replace(/[^a-z0-9 _-]+/gi, "").trim().replace(/\s+/g, "-").slice(0, 80) || "document";
  if (doc.format === "docx") {
    return { body: await renderDocx(model), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename: `${safeName}.docx` };
  }
  return { body: Buffer.from(await renderPdf(model)), contentType: "application/pdf", filename: `${safeName}.pdf` };
}
