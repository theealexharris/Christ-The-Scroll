import { and, desc, eq, max } from "drizzle-orm";
import { defaultOfferTerms, type OfferTerms } from "@workspace/dealpilot-core";
import { dpDeal, dpOfferDraft, type DpDb } from "@workspace/dealpilot-db";
import { notFound } from "../lib/http";
import { logActivity } from "./activity";
import { getDealContext, getOwnedDeal } from "./deals";

export async function listOfferDrafts(db: DpDb, userId: string, dealId: string) {
  await getOwnedDeal(db, userId, dealId);
  return db.select().from(dpOfferDraft).where(eq(dpOfferDraft.dealId, dealId)).orderBy(desc(dpOfferDraft.version));
}

/** Suggested starting terms for a deal that has no drafts yet. */
export async function suggestedOfferTerms(db: DpDb, userId: string, dealId: string): Promise<OfferTerms> {
  const ctx = await getDealContext(db, userId, dealId);
  const p = ctx.property;
  return defaultOfferTerms({
    address: [p.addressLine, p.city, `${p.state} ${p.postalCode ?? ""}`.trim()].join(", "),
    price: ctx.assumptions.purchasePrice,
    financing: ctx.assumptions.useFinancing,
  });
}

export async function createOfferDraft(db: DpDb, userId: string, dealId: string, input: { terms: OfferTerms; checklist: Record<string, boolean>; note?: string }) {
  const deal = await getOwnedDeal(db, userId, dealId);
  const row = await db.transaction(async (tx) => {
    const [{ current }] = await tx.select({ current: max(dpOfferDraft.version) }).from(dpOfferDraft).where(eq(dpOfferDraft.dealId, deal.id));
    const [created] = await tx
      .insert(dpOfferDraft)
      .values({ dealId: deal.id, version: (current ?? 0) + 1, terms: input.terms, checklist: input.checklist, note: input.note ?? null })
      .returning();
    if (deal.stage === "lead" || deal.stage === "analyzing") await tx.update(dpDeal).set({ stage: "offer_drafted" }).where(eq(dpDeal.id, deal.id));
    return created;
  });
  await logActivity(db, { ownerId: userId, dealId, type: "offer.draft", message: `Saved offer draft version ${row.version} for "${deal.name}" (draft only, not submitted).` });
  return row;
}

export async function getOwnedOfferDraft(db: DpDb, userId: string, draftId: string) {
  const [row] = await db
    .select({ draft: dpOfferDraft, deal: dpDeal })
    .from(dpOfferDraft)
    .innerJoin(dpDeal, eq(dpOfferDraft.dealId, dpDeal.id))
    .where(and(eq(dpOfferDraft.id, draftId), eq(dpDeal.ownerId, userId)));
  if (!row) throw notFound("Offer draft");
  return row;
}
