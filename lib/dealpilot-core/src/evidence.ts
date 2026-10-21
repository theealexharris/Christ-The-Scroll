import type { DealCategory, PropertyType, SourceStatus } from "./categories";
import type { DealAssumptions } from "./schemas";

export type PropertyFacts = {
  title: string;
  addressLine: string;
  city: string;
  state: string;
  category: DealCategory;
  propertyType: PropertyType;
  sourceStatus: SourceStatus;
  isSample: boolean;
  listPrice: number | null;
  units: number | null;
  beds: number | null;
  baths: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  description: string | null;
  sourceName: string | null;
  sourceRetrievedAt: string | null;
};

export type EvidenceGap = {
  key: string;
  item: string;
  whyItMatters: string;
  priority: "high" | "medium" | "low";
};

/** Deterministically lists the evidence that is missing or only estimated. */
export function findEvidenceGaps(property: PropertyFacts, a: DealAssumptions): EvidenceGap[] {
  const gaps: EvidenceGap[] = [];
  const e = a.evidence;
  const isLand = property.propertyType === "land";
  if (property.isSample || property.sourceStatus === "demo") {
    gaps.push({ key: "sample_data", item: "This is fictional sample data", whyItMatters: "Nothing about this property is real. Use it only to learn the workflow.", priority: "high" });
  }
  if (!isLand && (e.rentSource === "none" || e.rentSource === "user_estimate")) {
    gaps.push({
      key: "rent",
      item: e.rentSource === "none" ? "No rent evidence" : "Rent is an unverified estimate",
      whyItMatters: "Rent drives NOI, cash flow, DSCR and cap rate. Support it with rent comparables or existing leases.",
      priority: "high",
    });
  }
  if (e.taxSource !== "tax_record") {
    gaps.push({ key: "taxes", item: "Property taxes not confirmed from the tax record", whyItMatters: "Taxes can be reassessed after a sale; the current bill may understate future taxes.", priority: "medium" });
  }
  if (e.insuranceSource !== "written_quote") {
    gaps.push({ key: "insurance", item: "No written insurance quote", whyItMatters: "Insurance costs vary widely by location, age and condition and directly reduce cash flow.", priority: "medium" });
  }
  if (!isLand && e.rehabSource !== "contractor_bid" && e.rehabSource !== "not_needed") {
    gaps.push({ key: "rehab", item: "Renovation budget is not backed by a contractor bid", whyItMatters: "Under-estimated repairs are a common cause of losses and raise cash required.", priority: a.renovationCosts > 0 ? "high" : "medium" });
  }
  if (e.valueSource !== "sales_comps" && e.valueSource !== "appraisal") {
    gaps.push({ key: "value", item: "Value not supported by sales comparables or an appraisal", whyItMatters: "Without comps you cannot judge whether the price, ARV or exit value is reasonable.", priority: "high" });
  }
  if (!e.inspectionCompleted && !isLand) {
    gaps.push({ key: "inspection", item: "No property inspection recorded", whyItMatters: "Inspections uncover structural, roof, mechanical and safety issues that change the budget.", priority: "high" });
  }
  if (!e.titleSearchCompleted) {
    gaps.push({ key: "title", item: "No title search recorded", whyItMatters: "Liens, judgments or ownership defects can block or cloud the purchase.", priority: "high" });
  }
  if (!property.yearBuilt && !isLand) gaps.push({ key: "year_built", item: "Year built unknown", whyItMatters: "Age informs capital-expenditure reserves and insurance.", priority: "low" });
  if (!property.squareFeet && !isLand) gaps.push({ key: "sqft", item: "Square footage unknown", whyItMatters: "Needed to compare price and rent per square foot against comparables.", priority: "low" });
  if (!property.sourceRetrievedAt && !property.isSample) {
    gaps.push({ key: "freshness", item: "No source timestamp", whyItMatters: "Listing status and price may have changed since the data was captured.", priority: "low" });
  }
  return gaps;
}
