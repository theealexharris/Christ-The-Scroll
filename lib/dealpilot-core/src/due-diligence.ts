import type { DealCategory } from "./categories";
import { findEvidenceGaps, type PropertyFacts } from "./evidence";
import type { DealAssumptions } from "./schemas";

export type GeneratedTask = {
  key: string;
  title: string;
  category: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

const BASE_TASKS: GeneratedTask[] = [
  { key: "title_search", title: "Order a title search / preliminary title report", category: "Title & legal", detail: "Identify liens, judgments, easements and ownership issues. Work with a title company or real estate attorney.", priority: "high" },
  { key: "verify_ownership", title: "Verify the seller has authority to sell", category: "Title & legal", detail: "Confirm the person signing matches the vested owner or has documented authority.", priority: "high" },
  { key: "tax_record", title: "Pull the current property tax record", category: "Financial", detail: "Confirm the annual tax bill, assessment and any delinquent taxes. Ask how a sale affects reassessment.", priority: "medium" },
  { key: "insurance_quote", title: "Get a written insurance quote", category: "Insurance", detail: "Include liability coverage and ask about flood or other hazard zones.", priority: "medium" },
  { key: "zoning", title: "Confirm zoning and permitted use", category: "Zoning & permits", detail: "Check with the local planning department that the intended use is allowed.", priority: "medium" },
  { key: "permits", title: "Check permit history and open code violations", category: "Zoning & permits", detail: "Unpermitted work or open violations can add cost and delay.", priority: "medium" },
  { key: "sales_comps", title: "Collect recent comparable sales", category: "Market", detail: "Use permitted data sources or a licensed agent/appraiser to support the price and exit value.", priority: "high" },
  { key: "financing_quote", title: "Request financing quotes in writing", category: "Financing", detail: "Compare rate, fees, prepayment terms and reserve requirements. Scenarios in this app are illustrative only.", priority: "medium" },
];

const IMPROVED_PROPERTY_TASKS: GeneratedTask[] = [
  { key: "inspection", title: "Schedule a professional property inspection", category: "Physical inspection", detail: "Cover structure, roof, foundation, electrical, plumbing, HVAC and safety items.", priority: "high" },
  { key: "rent_comps", title: "Gather rent comparables", category: "Market", detail: "Support the rent assumption with comparable rentals or existing leases.", priority: "high" },
  { key: "contractor_bid", title: "Get contractor bids for repairs", category: "Physical inspection", detail: "Replace the renovation estimate with itemized bids.", priority: "medium" },
  { key: "utilities", title: "Review utility history and who pays which utilities", category: "Financial", detail: "Confirm metering and average monthly costs.", priority: "low" },
];

const CATEGORY_TASKS: Partial<Record<DealCategory, GeneratedTask[]>> = {
  probate: [
    { key: "probate_authority", title: "Confirm executor/administrator authority and court requirements", category: "Title & legal", detail: "Probate sales may require court approval, notice periods or overbid procedures. Consult a probate attorney.", priority: "high" },
  ],
  foreclosure: [
    { key: "foreclosure_status", title: "Confirm foreclosure stage and lender/servicer contact", category: "Title & legal", detail: "Determine whether the property is pre-foreclosure, scheduled for sale or post-sale, and which liens survive.", priority: "high" },
    { key: "occupancy", title: "Determine occupancy status lawfully", category: "Physical inspection", detail: "Occupied properties may require a lawful possession process. Never enter without permission.", priority: "high" },
  ],
  sheriff_sale: [
    { key: "auction_terms", title: "Read the auction terms and deposit requirements", category: "Title & legal", detail: "Many auctions require certified funds, sell as-is, and do not allow interior inspection.", priority: "high" },
    { key: "redemption", title: "Check redemption-period rules", category: "Title & legal", detail: "Some jurisdictions let the former owner redeem after the sale.", priority: "high" },
  ],
  reo: [{ key: "bank_addenda", title: "Review bank addenda and as-is clauses", category: "Title & legal", detail: "Lender-owned sales often include addenda that change standard contract terms.", priority: "medium" }],
  tax_sale: [
    { key: "tax_redemption", title: "Confirm tax-sale redemption rights and title insurability", category: "Title & legal", detail: "Tax deeds may require a quiet-title action before title insurance is available.", priority: "high" },
  ],
  land_bank: [{ key: "land_bank_program", title: "Review land bank program eligibility and obligations", category: "Title & legal", detail: "Programs may require owner occupancy, rehab timelines or end-use restrictions.", priority: "high" }],
  motivated_seller: [{ key: "seller_motivation", title: "Document the seller's situation and timeline", category: "Negotiation", detail: "Confirm decision-makers and any existing mortgage balance or liens.", priority: "medium" }],
  land: [
    { key: "survey", title: "Order a boundary survey", category: "Physical inspection", detail: "Confirm boundaries, encroachments and legal access.", priority: "high" },
    { key: "utilities_access", title: "Confirm road access and utility availability", category: "Zoning & permits", detail: "Check water, sewer/septic feasibility (perc test), power and road maintenance.", priority: "high" },
  ],
};

/** Builds a deduplicated due-diligence checklist for a deal. */
export function generateDueDiligenceTasks(property: PropertyFacts, a: DealAssumptions): GeneratedTask[] {
  const isLand = property.propertyType === "land";
  const tasks = [...BASE_TASKS, ...(isLand ? [] : IMPROVED_PROPERTY_TASKS), ...(CATEGORY_TASKS[property.category] ?? [])];
  if (isLand && property.category !== "land") tasks.push(...(CATEGORY_TASKS.land ?? []));
  if (property.propertyType === "condo") {
    tasks.push({ key: "hoa_docs", title: "Review HOA budget, reserves, rules and rental restrictions", category: "Financial", detail: "Some HOAs cap or prohibit rentals and may have special assessments.", priority: "high" });
  }
  if (property.propertyType === "mixed_use" || property.propertyType === "commercial") {
    tasks.push({ key: "commercial_leases", title: "Review commercial leases and estoppel certificates", category: "Financial", detail: "Confirm rent, term, renewal options and who pays expenses.", priority: "high" });
  }
  if ((property.units ?? 1) > 1) {
    tasks.push({ key: "rent_roll", title: "Request the rent roll, leases and deposit ledger", category: "Financial", detail: "Verify every unit's rent, term and security deposit.", priority: "high" });
  }
  if (a.useFinancing && a.loanTermYears > 0 && a.loanTermYears < a.amortizationYears) {
    tasks.push({ key: "balloon_plan", title: "Plan for the balloon payment", category: "Financing", detail: "Decide how the remaining balance will be refinanced or repaid at maturity.", priority: "medium" });
  }
  if (property.yearBuilt && property.yearBuilt < 1978 && !isLand) {
    tasks.push({ key: "lead_paint", title: "Address lead-based paint disclosure requirements", category: "Title & legal", detail: "Housing built before 1978 has federal lead-paint disclosure rules.", priority: "medium" });
  }
  const seen = new Set<string>();
  const out = tasks.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
  const gapKeys = new Set(findEvidenceGaps(property, a).map((g) => g.key));
  // Drop tasks whose evidence the user has already recorded.
  return out.filter((t) => {
    if (t.key === "inspection") return gapKeys.has("inspection");
    if (t.key === "title_search") return gapKeys.has("title");
    if (t.key === "insurance_quote") return gapKeys.has("insurance");
    if (t.key === "tax_record") return gapKeys.has("taxes");
    if (t.key === "rent_comps") return gapKeys.has("rent");
    if (t.key === "sales_comps") return gapKeys.has("value");
    if (t.key === "contractor_bid") return gapKeys.has("rehab");
    return true;
  });
}
