import type {
  AiAnswer,
  AiReview,
  Brand,
  CalcWarning,
  DealAssumptions,
  EvidenceGap,
  FinancingParams,
  FinancingResult,
  OfferTerms,
  Preferences,
  UnderwritingResult,
  WorkflowStatus,
} from "@workspace/dealpilot-core";

export type Meta = { brand: Brand; aiMode: "demo" | "live"; aiModel: string | null; allowDemoAccounts: boolean; signedIn: boolean };

export type SourceRecord = { id: string; sourceStatus: string; sourceName: string | null; sourceUrl: string | null; retrievedAt: string; notes: string | null };

export type Property = {
  id: string;
  ownerId: string | null;
  isSample: boolean;
  sampleKey: string | null;
  title: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string | null;
  category: string;
  propertyType: string;
  sourceStatus: string;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  units: number | null;
  squareFeet: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
  estimatedRentMonthly: number | null;
  annualTaxes: number | null;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sources: SourceRecord[];
  latestSource: SourceRecord | null;
};

export type PropertyPage = { items: Property[]; page: number; pageSize: number; total: number; totalPages: number; showingSamples: boolean };

export type Deal = {
  id: string;
  ownerId: string;
  propertyId: string;
  name: string;
  stage: string;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DealListItem = Deal & {
  property: Pick<Property, "id" | "title" | "addressLine" | "city" | "state" | "category" | "propertyType" | "sourceStatus" | "isSample" | "listPrice">;
  headline: { purchasePrice: number; monthlyCashFlow: number; capRatePct: number | null; cashOnCashPct: number | null; dscr: number | null } | null;
};

export type Scenario = { id: string; dealId: string; kind: string; name: string; params: FinancingParams; result: FinancingResult; createdAt: string; updatedAt: string };

export type DealDetail = {
  deal: Deal;
  property: Property;
  assumptionVersion: number;
  assumptions: DealAssumptions;
  underwriting: UnderwritingResult;
  scenarios: Scenario[];
  evidenceGaps: EvidenceGap[];
};

export type WorkflowStep = { id: string; key: string; position: number; status: string; output: unknown; error: string | null; startedAt: string | null; finishedAt: string | null };
export type WorkflowRun = {
  id: string;
  dealId: string;
  status: WorkflowStatus;
  currentStep: string | null;
  error: string | null;
  attempts: number;
  aiMode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
};

export type AiMessage = {
  id: string;
  dealId: string;
  kind: "review" | "question" | "answer";
  mode: "demo" | "live";
  provider: string | null;
  model: string | null;
  content: (AiReview & { assumptionVersion?: number }) | { question: string } | (AiAnswer & { assumptionVersion?: number });
  createdAt: string;
};

export type Task = {
  id: string;
  dealId: string;
  generatedKey: string | null;
  title: string;
  category: string;
  detail: string | null;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done" | "not_applicable";
  source: "user" | "workflow";
  dueDate: string | null;
  createdAt: string;
};

export type OfferDraft = { id: string; dealId: string; version: number; terms: OfferTerms; checklist: Record<string, boolean>; note: string | null; createdAt: string };
export type OfferDraftList = { items: OfferDraft[]; checklist: { key: string; label: string }[]; suggestedTerms: OfferTerms | null };

export type GeneratedDocument = { id: string; kind: "investment_report" | "offer_draft"; format: "pdf" | "docx"; title: string; offerDraftId: string | null; createdAt: string };

export type ActivityEvent = { id: string; ownerId: string; dealId: string | null; propertyId: string | null; type: string; message: string; createdAt: string };

export type Dashboard = {
  savedDeals: number;
  sampleDeals: number;
  stageCounts: Record<string, number>;
  activeAnalyses: { id: string; dealId: string; status: WorkflowStatus; updatedAt: string; dealName: string }[];
  draftOffers: number;
  openTasks: number;
  ownProperties: number;
  recentDeals: DealListItem[];
  recentActivity: ActivityEvent[];
};

export type Integration = { id: string; name: string; purpose: string; state: "connected" | "not_configured" | "error"; detail: string; envVars: string[]; fallback: string };

export type SavedSearch = { id: string; name: string; filters: Record<string, string | number | boolean>; createdAt: string };

export type { CalcWarning, Preferences };
