import { z } from "zod";
import { labelFor, DEAL_CATEGORIES, PROPERTY_TYPES } from "./categories";
import { generateDueDiligenceTasks } from "./due-diligence";
import { findEvidenceGaps, type PropertyFacts } from "./evidence";
import type { FinancingResult } from "./financing";
import { formatCurrency, formatPercent, formatRatio } from "./format";
import type { DealAssumptions } from "./schemas";
import type { UnderwritingResult } from "./underwriting";

/** How a statement in an AI response is supported. Shown next to every claim. */
export const STATEMENT_BASES = ["calculated", "user_supplied", "assumption", "unverified_hypothesis"] as const;
export type StatementBasis = (typeof STATEMENT_BASES)[number];

export const AiReviewSchema = z.object({
  summary: z.string().min(1).max(3000),
  metricExplanations: z
    .array(z.object({ metric: z.string().max(120), explanation: z.string().max(1500), basis: z.enum(STATEMENT_BASES) }))
    .max(12),
  financingNotes: z.string().max(3000),
  risks: z
    .array(z.object({ title: z.string().max(200), detail: z.string().max(1500), severity: z.enum(["high", "medium", "low"]), basis: z.enum(STATEMENT_BASES) }))
    .max(15),
  missingEvidence: z.array(z.object({ item: z.string().max(200), whyItMatters: z.string().max(800) })).max(15),
  checklist: z.array(z.object({ title: z.string().max(200), category: z.string().max(60) })).max(20),
  plainLanguageSummary: z.string().max(3000),
});
export type AiReview = z.infer<typeof AiReviewSchema>;

export const AiAnswerSchema = z.object({
  answer: z.string().min(1).max(4000),
  basis: z.enum(STATEMENT_BASES),
  followUps: z.array(z.string().max(200)).max(4),
});
export type AiAnswer = z.infer<typeof AiAnswerSchema>;

export type AnalystContext = {
  property: PropertyFacts;
  assumptions: DealAssumptions;
  underwriting: UnderwritingResult;
  financing: FinancingResult[];
};

/** Compact JSON payload sent to a live model. Contains only validated, user-visible data. */
export function serializeContextForModel(ctx: AnalystContext): string {
  const { property, assumptions, underwriting, financing } = ctx;
  return JSON.stringify(
    {
      property: { ...property, categoryLabel: labelFor(DEAL_CATEGORIES, property.category), propertyTypeLabel: labelFor(PROPERTY_TYPES, property.propertyType) },
      assumptions,
      underwriting: {
        acquisition: underwriting.acquisition,
        operating: underwriting.operating,
        debt: underwriting.debt,
        cashFlow: underwriting.cashFlow,
        metrics: underwriting.metrics,
        exit: underwriting.exit,
        warnings: underwriting.warnings.map((w) => w.message),
      },
      financingScenarios: financing.map((f) => ({
        name: f.name,
        kind: f.kind,
        cashToClose: f.cashToClose,
        monthlyDebtService: f.monthlyDebtService,
        monthlyCashFlow: f.monthlyCashFlow,
        dscr: f.dscr,
        cashOnCashPct: f.cashOnCashPct,
        warnings: f.warnings.map((w) => w.message),
      })),
      evidenceGaps: findEvidenceGaps(property, assumptions).map((g) => g.item),
    },
    null,
    0,
  );
}

const prefix = (ctx: AnalystContext) => (ctx.property.isSample ? "This is fictional SAMPLE data. " : "");

/** Deterministic, template-based review used when no LLM is configured. */
export function buildDemoReview(ctx: AnalystContext): AiReview {
  const { property, assumptions: a, underwriting: u, financing } = ctx;
  const m = u.metrics;
  const isLand = property.propertyType === "land";
  const cf = u.cashFlow.monthly;

  const summary =
    prefix(ctx) +
    `${property.title} (${labelFor(PROPERTY_TYPES, property.propertyType)}, ${labelFor(DEAL_CATEGORIES, property.category)}) at a purchase price of ${formatCurrency(a.purchasePrice)}. ` +
    (isLand || a.monthlyRent === 0
      ? "No rental income is modeled, so income-based returns are not meaningful; evaluate this deal on land value, carrying costs and exit plan."
      : `Based on the assumptions entered, projected NOI is ${formatCurrency(u.operating.noiAnnual)}/year and cash flow is ${formatCurrency(cf)}/month ` +
        `(cap rate ${formatPercent(m.capRatePct)}, cash-on-cash ${formatPercent(m.cashOnCashPct)}${m.dscr !== null ? `, DSCR ${formatRatio(m.dscr)}` : ""}).`);

  const metricExplanations: AiReview["metricExplanations"] = [
    {
      metric: "Total cash required",
      explanation: `${formatCurrency(u.acquisition.totalCashRequired)} = down payment ${formatCurrency(u.acquisition.downPayment)} + closing costs ${formatCurrency(u.acquisition.closingCosts)} + renovation ${formatCurrency(u.acquisition.renovationCosts)} + loan fees ${formatCurrency(u.acquisition.loanFees)}.`,
      basis: "calculated",
    },
  ];
  if (!isLand && a.monthlyRent > 0) {
    metricExplanations.push(
      {
        metric: "Net operating income",
        explanation: `Effective gross income of ${formatCurrency(u.operating.effectiveGrossIncomeMonthly)}/month (after ${a.vacancyRatePct}% vacancy) minus operating expenses of ${formatCurrency(u.operating.operatingExpensesMonthly)}/month gives NOI of ${formatCurrency(u.operating.noiMonthly)}/month.`,
        basis: "calculated",
      },
      {
        metric: "Cap rate",
        explanation: `Annual NOI ÷ purchase price = ${formatPercent(m.capRatePct)}. It ignores financing, so it compares properties on an unlevered basis.`,
        basis: "calculated",
      },
      {
        metric: "Cash-on-cash return",
        explanation: `Annual cash flow ${formatCurrency(u.cashFlow.annual)} ÷ cash required ${formatCurrency(u.acquisition.totalCashRequired)} = ${formatPercent(m.cashOnCashPct)}. This is a first-year estimate, not a guaranteed yield.`,
        basis: "calculated",
      },
    );
    if (m.dscr !== null) {
      metricExplanations.push({
        metric: "DSCR",
        explanation: `NOI covers debt service ${formatRatio(m.dscr)}. Below 1.00x means the property does not pay its own mortgage under these assumptions.`,
        basis: "calculated",
      });
    }
    if (m.breakEvenOccupancyPct !== null) {
      metricExplanations.push({
        metric: "Break-even occupancy",
        explanation: `The property needs about ${formatPercent(m.breakEvenOccupancyPct, 1)} occupancy to cover operating expenses and debt service.`,
        basis: "calculated",
      });
    }
  }

  const sorted = [...financing].sort((x, y) => y.monthlyCashFlow - x.monthlyCashFlow);
  const financingNotes =
    financing.length === 0
      ? "No financing scenarios saved yet. Add scenarios on the Financing tab to compare cash, loan and seller-finance structures."
      : `Compared ${financing.length} illustrative scenario(s). Highest monthly cash flow: ${sorted[0].name} (${formatCurrency(sorted[0].monthlyCashFlow)}/month, ${formatCurrency(sorted[0].cashToClose)} cash to close). ` +
        `Lowest cash to close: ${[...financing].sort((x, y) => x.cashToClose - y.cashToClose)[0].name}. ` +
        "More leverage usually lowers cash to close but raises debt service and risk. None of these are loan offers.";

  const risks: AiReview["risks"] = [];
  for (const w of u.warnings.filter((w) => w.severity !== "info")) {
    risks.push({ title: w.message.split(".")[0], detail: w.message, severity: w.severity === "error" ? "high" : "medium", basis: "calculated" });
  }
  if (a.vacancyRatePct < 5 && !isLand) risks.push({ title: "Optimistic vacancy", detail: `Vacancy is set to ${a.vacancyRatePct}%. A higher figure may be more conservative.`, severity: "medium", basis: "assumption" });
  if (property.yearBuilt && property.yearBuilt < 1960) risks.push({ title: "Older building", detail: `Built in ${property.yearBuilt} (user-supplied). Older systems can need larger capital reserves; an inspection would confirm.`, severity: "medium", basis: "unverified_hypothesis" });
  if (["foreclosure", "sheriff_sale", "tax_sale"].includes(property.category))
    risks.push({ title: "Distressed-sale process risk", detail: "Distressed sales can involve surviving liens, redemption rights, limited inspection and occupancy issues. Confirm with a local attorney.", severity: "high", basis: "unverified_hypothesis" });

  const gaps = findEvidenceGaps(property, a);
  const tasks = generateDueDiligenceTasks(property, a);

  const plainLanguageSummary =
    prefix(ctx) +
    (isLand || a.monthlyRent === 0
      ? `You would put about ${formatCurrency(u.acquisition.totalCashRequired)} into this property, and it does not produce rent in this model. `
      : cf >= 0
        ? `If every assumption holds, this property would put about ${formatCurrency(cf)} in your pocket each month after paying expenses and the loan, on about ${formatCurrency(u.acquisition.totalCashRequired)} of cash invested. `
        : `If every assumption holds, this property would cost you about ${formatCurrency(Math.abs(cf))} each month after expenses and the loan, on about ${formatCurrency(u.acquisition.totalCashRequired)} of cash invested. `) +
    `${gaps.length} piece(s) of evidence are missing or unverified; resolve the high-priority ones before making a decision.`;

  return {
    summary,
    metricExplanations,
    financingNotes,
    risks: risks.slice(0, 15),
    missingEvidence: gaps.slice(0, 15).map((g) => ({ item: g.item, whyItMatters: g.whyItMatters })),
    checklist: tasks.slice(0, 20).map((t) => ({ title: t.title, category: t.category })),
    plainLanguageSummary,
  };
}

/** Deterministic keyword-routed answers for demo mode. */
export function answerQuestionDemo(question: string, ctx: AnalystContext): AiAnswer {
  const q = question.toLowerCase();
  const review = buildDemoReview(ctx);
  const find = (name: string) => review.metricExplanations.find((m) => m.metric.toLowerCase().includes(name));
  const reply = (answer: string, basis: AiAnswer["basis"] = "calculated"): AiAnswer => ({
    answer: prefix(ctx) + answer,
    basis,
    followUps: ["What evidence is missing?", "How do the financing scenarios compare?", "What are the biggest risks?"],
  });
  if (/cap\s*rate/.test(q)) return reply(find("cap rate")?.explanation ?? "Cap rate needs rent and a purchase price to calculate.");
  if (/cash[- ]on[- ]cash|coc|return/.test(q)) return reply(find("cash-on-cash")?.explanation ?? "Cash-on-cash needs rent and cash invested to calculate.");
  if (/dscr|coverage/.test(q)) return reply(find("dscr")?.explanation ?? "No loan is modeled, so DSCR does not apply.");
  if (/noi|net operating|expense/.test(q)) return reply(find("net operating")?.explanation ?? "NOI is not meaningful without rental income.");
  if (/break[- ]?even|occupan/.test(q)) return reply(find("break-even")?.explanation ?? "Break-even occupancy needs rental income to calculate.");
  if (/financ|loan|seller|mortgage|dscr loan/.test(q)) return reply(review.financingNotes);
  if (/risk|concern|worr|red flag/.test(q))
    return reply(review.risks.length ? review.risks.map((r) => `• ${r.title}: ${r.detail}`).join("\n") : "No calculated warnings were triggered, but unverified inputs are still a risk.", "calculated");
  if (/missing|evidence|verify|unknown/.test(q)) return reply(review.missingEvidence.map((g) => `• ${g.item}: ${g.whyItMatters}`).join("\n"), "calculated");
  if (/checklist|due diligence|next step|todo|to-do/.test(q)) return reply(review.checklist.map((c) => `• [${c.category}] ${c.title}`).join("\n"), "calculated");
  if (/cash (to close|required|needed)|how much (cash|money)/.test(q)) return reply(find("total cash")?.explanation ?? "");
  if (/(comp|comparable|zoning|lien|owner|crime|school|flood|neighborhood|market value|appreciat)/.test(q))
    return reply(
      "Demo mode has no access to external data, so I can't answer questions about comparables, zoning, liens, ownership, schools, crime, flood zones or market trends. Those require verified sources such as county records, a licensed agent or appraiser, or a title company.",
      "unverified_hypothesis",
    );
  return reply(review.plainLanguageSummary);
}
