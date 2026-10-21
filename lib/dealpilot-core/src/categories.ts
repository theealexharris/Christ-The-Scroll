export const DEAL_CATEGORIES = [
  { id: "on_market", label: "On-market properties" },
  { id: "probate", label: "Probate opportunities" },
  { id: "foreclosure", label: "Foreclosures" },
  { id: "land_bank", label: "Land bank" },
  { id: "sheriff_sale", label: "Sheriff sales / auctions" },
  { id: "reo", label: "Bank-owned / REO" },
  { id: "motivated_seller", label: "Motivated sellers" },
  { id: "tax_sale", label: "Tax deed / tax sale" },
  { id: "land", label: "Land" },
] as const;

export type DealCategory = (typeof DEAL_CATEGORIES)[number]["id"];
export const DEAL_CATEGORY_IDS = DEAL_CATEGORIES.map((c) => c.id) as [DealCategory, ...DealCategory[]];

/**
 * Where a property record came from. These labels never imply access to an
 * official feed: "live_provider" is only used when a configured provider
 * adapter actually returned the record.
 */
export const SOURCE_STATUSES = [
  { id: "live_provider", label: "Live provider" },
  { id: "user_imported", label: "User-imported" },
  { id: "manual_entry", label: "Manual entry" },
  { id: "demo", label: "Demo / sample" },
] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number]["id"];
export const SOURCE_STATUS_IDS = SOURCE_STATUSES.map((s) => s.id) as [SourceStatus, ...SourceStatus[]];

export const PROPERTY_TYPES = [
  { id: "single_family", label: "Single-family" },
  { id: "multi_family", label: "Multi-family (2–4)" },
  { id: "apartment", label: "Apartment (5+)" },
  { id: "condo", label: "Condo / townhome" },
  { id: "mixed_use", label: "Mixed-use" },
  { id: "commercial", label: "Commercial" },
  { id: "land", label: "Land / lot" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number]["id"];
export const PROPERTY_TYPE_IDS = PROPERTY_TYPES.map((p) => p.id) as [PropertyType, ...PropertyType[]];

export const DEAL_STAGES = [
  { id: "lead", label: "Lead" },
  { id: "analyzing", label: "Analyzing" },
  { id: "offer_drafted", label: "Offer drafted" },
  { id: "under_contract", label: "Under contract" },
  { id: "closed", label: "Closed" },
  { id: "passed", label: "Passed" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["id"];
export const DEAL_STAGE_IDS = DEAL_STAGES.map((s) => s.id) as [DealStage, ...DealStage[]];

export function labelFor<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}
