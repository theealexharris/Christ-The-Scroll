/**
 * Single source of truth for product branding. Rename the product by editing
 * this object; the web app, API, generated documents and AI prompts all read it.
 */
export const BRAND = {
  name: "DealPilot AI",
  shortName: "DealPilot",
  tagline: "Underwrite real estate deals with transparent math and an AI analyst that shows its work.",
  supportEmail: "support@example.com",
  /** Shown on every analysis screen and generated document. */
  disclaimer:
    "DealPilot AI is decision-support software, not a real estate broker, lender, appraiser, attorney, title company, " +
    "or tax advisor. Figures are estimates based on the assumptions shown and are not a guarantee of investment " +
    "performance. Independently verify all property facts, financing terms and legal requirements before acting.",
  draftLabel: "DRAFT — NOT SUBMITTED",
  sampleLabel: "SAMPLE DATA — NOT REAL LISTINGS",
} as const;

export type Brand = typeof BRAND;
