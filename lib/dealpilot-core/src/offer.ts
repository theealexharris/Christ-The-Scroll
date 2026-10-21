import { z } from "zod";
import { BRAND } from "./brand";
import { formatCurrency } from "./format";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable();

export const OfferTermsSchema = z.object({
  buyerName: z.string().trim().max(200).default("[Buyer name]"),
  sellerName: z.string().trim().max(200).default("[Seller name]"),
  propertyAddress: z.string().trim().min(1).max(300),
  proposedPrice: z.number().finite().min(0).max(1_000_000_000),
  earnestMoney: z.number().finite().min(0).max(100_000_000),
  dueDiligenceDays: z.number().int().min(0).max(365),
  financingContingency: z.boolean(),
  financingType: z.string().trim().max(120).default("Conventional loan"),
  inspectionContingency: z.boolean().default(true),
  appraisalContingency: z.boolean().default(false),
  closingDate: isoDate,
  offerExpiration: isoDate,
  sellerConcessions: z.number().finite().min(0).max(100_000_000).default(0),
  additionalTerms: z.string().max(5000).default(""),
});
export type OfferTerms = z.infer<typeof OfferTermsSchema>;

export const OFFER_REVIEW_CHECKLIST = [
  { key: "numbers_reviewed", label: "I reviewed the underwriting assumptions behind this price" },
  { key: "contingencies", label: "Contingencies and deadlines match my due-diligence plan" },
  { key: "financing_confirmed", label: "Financing terms are confirmed with a lender or seller in writing" },
  { key: "professional_review", label: "A licensed agent or real estate attorney will review before anything is signed" },
  { key: "jurisdiction_forms", label: "The final offer will use the forms required in this jurisdiction" },
] as const;

export const OfferDraftInputSchema = z.object({
  terms: OfferTermsSchema,
  checklist: z.record(z.boolean()).default({}),
  note: z.string().max(500).optional(),
});

export type OfferSection = { heading: string; lines: string[] };

/** Plain-text sections shared by the on-screen preview, PDF and DOCX exports. */
export function buildOfferSections(t: OfferTerms, version: number): OfferSection[] {
  const yesNo = (b: boolean) => (b ? "Yes" : "No");
  return [
    {
      heading: "Status",
      lines: [
        `${BRAND.draftLabel} · Version ${version}`,
        "This is a draft summary for discussion and professional review. It is not a binding offer, contract or signature.",
      ],
    },
    { heading: "Parties", lines: [`Buyer: ${t.buyerName}`, `Seller: ${t.sellerName}`] },
    { heading: "Property", lines: [t.propertyAddress] },
    {
      heading: "Price and deposit",
      lines: [`Proposed purchase price: ${formatCurrency(t.proposedPrice)}`, `Earnest money deposit: ${formatCurrency(t.earnestMoney)}`, `Requested seller concessions: ${formatCurrency(t.sellerConcessions)}`],
    },
    {
      heading: "Contingencies",
      lines: [
        `Due-diligence period: ${t.dueDiligenceDays} days`,
        `Inspection contingency: ${yesNo(t.inspectionContingency)}`,
        `Financing contingency: ${yesNo(t.financingContingency)}${t.financingContingency ? ` (${t.financingType})` : ""}`,
        `Appraisal contingency: ${yesNo(t.appraisalContingency)}`,
      ],
    },
    { heading: "Dates", lines: [`Target closing date: ${t.closingDate ?? "[To be determined]"}`, `Offer expiration: ${t.offerExpiration ?? "[To be determined]"}`] },
    { heading: "Additional terms", lines: t.additionalTerms.trim() ? t.additionalTerms.split(/\r?\n/) : ["None entered."] },
    { heading: "Disclaimer", lines: [BRAND.disclaimer] },
  ];
}

export function defaultOfferTerms(input: { address: string; price: number; financing: boolean }): OfferTerms {
  return {
    buyerName: "[Buyer name]",
    sellerName: "[Seller name]",
    propertyAddress: input.address,
    proposedPrice: input.price,
    earnestMoney: Math.round(input.price * 0.01),
    dueDiligenceDays: 14,
    financingContingency: input.financing,
    financingType: input.financing ? "Investor loan" : "Cash",
    inspectionContingency: true,
    appraisalContingency: false,
    closingDate: null,
    offerExpiration: null,
    sellerConcessions: 0,
    additionalTerms: "",
  };
}
