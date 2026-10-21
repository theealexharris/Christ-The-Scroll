import { z } from "zod";
import { DEAL_CATEGORY_IDS, DEAL_STAGE_IDS, PROPERTY_TYPE_IDS, SOURCE_STATUS_IDS } from "./categories";

const money = (max = 1_000_000_000) => z.number({ invalid_type_error: "Must be a number" }).finite().min(0, "Cannot be negative").max(max);
const pct = (max = 100) => z.number({ invalid_type_error: "Must be a number" }).finite().min(0, "Cannot be negative").max(max, `Must be ${max}% or less`);
const years = z.number({ invalid_type_error: "Must be a number" }).finite().min(0).max(50, "Must be 50 years or less");
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

export const PropertyInputSchema = z.object({
  title: z.string().trim().min(1, "Give the property a short name").max(160),
  addressLine: z.string().trim().min(1, "Address is required").max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(40),
  postalCode: z.string().trim().max(20).optional().nullable(),
  category: z.enum(DEAL_CATEGORY_IDS),
  propertyType: z.enum(PROPERTY_TYPE_IDS),
  listPrice: money().nullable().optional(),
  beds: z.number().int().min(0).max(500).nullable().optional(),
  baths: z.number().min(0).max(500).nullable().optional(),
  units: z.number().int().min(1).max(5000).nullable().optional(),
  squareFeet: z.number().int().min(0).max(10_000_000).nullable().optional(),
  lotSizeSqft: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  yearBuilt: z.number().int().min(1700).max(2100).nullable().optional(),
  estimatedRentMonthly: money(10_000_000).nullable().optional(),
  annualTaxes: money(100_000_000).nullable().optional(),
  description: optionalText(4000),
  sourceUrl: z.string().trim().url("Must be a full URL (https://…)").max(500).optional().nullable().or(z.literal("")),
  sourceName: optionalText(120),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;

export const PropertyUpdateSchema = PropertyInputSchema.partial();
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;

export const PROPERTY_SORTS = ["newest", "price_asc", "price_desc", "rent_yield_desc", "title_asc"] as const;
export type PropertySort = (typeof PROPERTY_SORTS)[number];

export const PropertySearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(DEAL_CATEGORY_IDS).optional(),
  propertyType: z.enum(PROPERTY_TYPE_IDS).optional(),
  sourceStatus: z.enum(SOURCE_STATUS_IDS).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBeds: z.coerce.number().int().min(0).optional(),
  state: z.string().trim().max(40).optional(),
  includeArchived: z.coerce.boolean().optional(),
  sort: z.enum(PROPERTY_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type PropertySearch = z.infer<typeof PropertySearchSchema>;

export const EVIDENCE_LEVELS = {
  rentSource: ["none", "user_estimate", "rent_comps", "signed_lease", "provider"],
  taxSource: ["none", "user_estimate", "tax_record"],
  insuranceSource: ["none", "user_estimate", "written_quote"],
  rehabSource: ["none", "user_estimate", "contractor_bid", "not_needed"],
  valueSource: ["none", "user_estimate", "sales_comps", "appraisal"],
} as const;

export const EvidenceSchema = z.object({
  rentSource: z.enum(EVIDENCE_LEVELS.rentSource).default("none"),
  taxSource: z.enum(EVIDENCE_LEVELS.taxSource).default("none"),
  insuranceSource: z.enum(EVIDENCE_LEVELS.insuranceSource).default("none"),
  rehabSource: z.enum(EVIDENCE_LEVELS.rehabSource).default("none"),
  valueSource: z.enum(EVIDENCE_LEVELS.valueSource).default("none"),
  inspectionCompleted: z.boolean().default(false),
  titleSearchCompleted: z.boolean().default(false),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Every input the underwriting engine uses. Money is USD; monthly vs annual is
 * encoded in the field name. Percentages are 0–100.
 */
export const DealAssumptionsSchema = z.object({
  purchasePrice: money(),
  closingCosts: money(),
  renovationCosts: money(),
  afterRepairValue: money().nullable().default(null),

  monthlyRent: money(10_000_000),
  otherMonthlyIncome: money(10_000_000).default(0),
  vacancyRatePct: pct(),

  propertyTaxesAnnual: money(100_000_000),
  insuranceAnnual: money(100_000_000),
  hoaMonthly: money(1_000_000).default(0),
  maintenancePct: pct(),
  capexReservePct: pct(),
  managementPct: pct(),
  utilitiesMonthly: money(1_000_000).default(0),
  otherExpensesMonthly: money(1_000_000).default(0),

  useFinancing: z.boolean(),
  downPaymentPct: pct(),
  interestRatePct: pct(30),
  loanTermYears: years,
  amortizationYears: years,
  loanFees: money(100_000_000).default(0),

  holdYears: z.number().int().min(1).max(40).default(5),
  annualAppreciationPct: z.number().finite().min(-20).max(20).default(2),
  sellingCostsPct: pct(20).default(6),

  evidence: EvidenceSchema.default({}),
});
export type DealAssumptions = z.infer<typeof DealAssumptionsSchema>;
export type DealAssumptionsInput = z.input<typeof DealAssumptionsSchema>;

export const FINANCING_KINDS = [
  { id: "cash", label: "Cash purchase" },
  { id: "conventional", label: "Investor / conventional loan" },
  { id: "dscr", label: "DSCR-style loan" },
  { id: "seller", label: "Seller financing" },
  { id: "hybrid", label: "Hybrid (bank + seller carry)" },
] as const;
export type FinancingKind = (typeof FINANCING_KINDS)[number]["id"];
export const FINANCING_KIND_IDS = FINANCING_KINDS.map((k) => k.id) as [FinancingKind, ...FinancingKind[]];

export const FinancingParamsSchema = z.object({
  kind: z.enum(FINANCING_KIND_IDS),
  name: z.string().trim().min(1).max(120),
  downPaymentPct: pct(),
  interestRatePct: pct(30),
  termYears: years,
  amortizationYears: years,
  interestOnly: z.boolean().default(false),
  balloonYears: z.number().int().min(1).max(40).nullable().default(null),
  lenderFeesPct: pct(10).default(0),
  minDscr: z.number().min(0).max(5).nullable().default(null),
  // Seller carry (used by "seller" and "hybrid")
  sellerCarryPct: pct().default(0),
  sellerRatePct: pct(30).default(0),
  sellerAmortizationYears: years.default(30),
  sellerBalloonYears: z.number().int().min(1).max(40).nullable().default(null),
  sellerInterestOnly: z.boolean().default(false),
});
export type FinancingParams = z.infer<typeof FinancingParamsSchema>;
export type FinancingParamsInput = z.input<typeof FinancingParamsSchema>;

export const DealCreateSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
});

export const DealUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  stage: z.enum(DEAL_STAGE_IDS).optional(),
  notes: z.string().max(10_000).optional().nullable(),
});

export const TASK_STATUSES = ["open", "in_progress", "done", "not_applicable"] as const;
export const TASK_PRIORITIES = ["high", "medium", "low"] as const;

export const TaskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(60).default("General"),
  detail: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().nullable(),
});
export const TaskUpdateSchema = TaskInputSchema.partial().extend({
  status: z.enum(TASK_STATUSES).optional(),
});

export const SavedSearchInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: PropertySearchSchema.omit({ page: true, pageSize: true }).partial(),
});

export const PreferencesSchema = z.object({
  showSampleData: z.boolean().default(true),
  defaultVacancyRatePct: pct().default(6),
  defaultInterestRatePct: pct(30).default(7.25),
  defaultDownPaymentPct: pct().default(25),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const AiChatInputSchema = z.object({
  question: z.string().trim().min(3, "Ask a slightly longer question").max(1000),
});
