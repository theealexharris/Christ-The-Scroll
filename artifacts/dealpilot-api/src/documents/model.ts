import {
  BRAND,
  buildOfferSections,
  DEAL_CATEGORIES,
  formatCurrency,
  formatPercent,
  formatRatio,
  labelFor,
  PROPERTY_TYPES,
  SOURCE_STATUSES,
  type AiReview,
  type DealAssumptions,
  type EvidenceGap,
  type FinancingResult,
  type OfferTerms,
  type PropertyFacts,
  type UnderwritingResult,
} from "@workspace/dealpilot-core";

/** Format-neutral document description rendered to PDF and DOCX. */
export type DocSection = { heading: string; lines?: string[]; table?: [string, string][] };
export type DocModel = { title: string; subtitle: string; banners: string[]; sections: DocSection[]; footer: string };

export type InvestmentReportSnapshot = {
  kind: "investment_report";
  generatedAt: string;
  dealName: string;
  property: PropertyFacts;
  assumptionVersion: number;
  assumptions: DealAssumptions;
  underwriting: UnderwritingResult;
  financing: FinancingResult[];
  review: { mode: string; model: string | null; createdAt: string; content: AiReview } | null;
  evidenceGaps: EvidenceGap[];
  tasks: { title: string; category: string; status: string; priority: string }[];
};

export type OfferDraftSnapshot = {
  kind: "offer_draft";
  generatedAt: string;
  dealName: string;
  isSample: boolean;
  version: number;
  terms: OfferTerms;
  checklist: Record<string, boolean>;
};

export type DocumentSnapshot = InvestmentReportSnapshot | OfferDraftSnapshot;

const fmtDate = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export function buildDocModel(s: DocumentSnapshot): DocModel {
  if (s.kind === "offer_draft") {
    return {
      title: `Offer summary — ${s.dealName}`,
      subtitle: `Generated ${fmtDate(s.generatedAt)} by ${BRAND.name}`,
      banners: [BRAND.draftLabel, ...(s.isSample ? [BRAND.sampleLabel] : [])],
      sections: buildOfferSections(s.terms, s.version).map((sec) => ({ heading: sec.heading, lines: sec.lines })),
      footer: `${BRAND.draftLabel} · Not a binding offer · ${BRAND.name}`,
    };
  }
  const { property: p, assumptions: a, underwriting: u } = s;
  const sections: DocSection[] = [
    {
      heading: "Property",
      table: [
        ["Name", p.title],
        ["Address", `${p.addressLine}, ${p.city}, ${p.state}`],
        ["Category", labelFor(DEAL_CATEGORIES, p.category)],
        ["Type", labelFor(PROPERTY_TYPES, p.propertyType)],
        ["Source", `${labelFor(SOURCE_STATUSES, p.sourceStatus)}${p.sourceName ? ` — ${p.sourceName}` : ""}`],
        ["Source retrieved", p.sourceRetrievedAt ? fmtDate(p.sourceRetrievedAt) : "Unknown"],
        ["Units / beds / baths", `${p.units ?? "—"} / ${p.beds ?? "—"} / ${p.baths ?? "—"}`],
        ["Square feet / year built", `${p.squareFeet ?? "—"} / ${p.yearBuilt ?? "—"}`],
      ],
    },
    {
      heading: `Key results (assumptions v${s.assumptionVersion})`,
      table: [
        ["Purchase price", formatCurrency(u.acquisition.purchasePrice)],
        ["Total cash required", formatCurrency(u.acquisition.totalCashRequired)],
        ["NOI (annual)", formatCurrency(u.operating.noiAnnual)],
        ["Debt service (monthly)", formatCurrency(u.debt.monthlyDebtService)],
        ["Cash flow (monthly / annual)", `${formatCurrency(u.cashFlow.monthly)} / ${formatCurrency(u.cashFlow.annual)}`],
        ["Cap rate", formatPercent(u.metrics.capRatePct)],
        ["Cash-on-cash return", formatPercent(u.metrics.cashOnCashPct)],
        ["DSCR", formatRatio(u.metrics.dscr)],
        ["Break-even occupancy", formatPercent(u.metrics.breakEvenOccupancyPct)],
        [`Estimated equity at year ${u.exit.holdYears}`, formatCurrency(u.exit.equityAtExit)],
      ],
    },
    {
      heading: "Assumptions",
      table: [
        ["Closing / renovation costs", `${formatCurrency(a.closingCosts)} / ${formatCurrency(a.renovationCosts)}`],
        ["Monthly rent / other income", `${formatCurrency(a.monthlyRent)} / ${formatCurrency(a.otherMonthlyIncome)}`],
        ["Vacancy", formatPercent(a.vacancyRatePct, 1)],
        ["Taxes / insurance (annual)", `${formatCurrency(a.propertyTaxesAnnual)} / ${formatCurrency(a.insuranceAnnual)}`],
        ["HOA / utilities / other (monthly)", `${formatCurrency(a.hoaMonthly)} / ${formatCurrency(a.utilitiesMonthly)} / ${formatCurrency(a.otherExpensesMonthly)}`],
        ["Maintenance / capex / management", `${a.maintenancePct}% / ${a.capexReservePct}% / ${a.managementPct}%`],
        [
          "Financing",
          a.useFinancing ? `${a.downPaymentPct}% down, ${a.interestRatePct}% rate, ${a.loanTermYears}-yr term, ${a.amortizationYears}-yr amortization` : "Cash purchase",
        ],
        ["Exit", `${a.holdYears} yrs, ${a.annualAppreciationPct}%/yr appreciation, ${a.sellingCostsPct}% selling costs`],
      ],
    },
    { heading: "Formulas", lines: u.formulas.map((f) => `${f.label}: ${f.formula}`) },
    { heading: "Calculation warnings", lines: u.warnings.length ? u.warnings.map((w) => `[${w.severity}] ${w.message}`) : ["None."] },
    {
      heading: "Financing scenarios (illustrative — not loan offers)",
      lines: s.financing.length
        ? s.financing.map(
            (f) =>
              `${f.name}: cash to close ${formatCurrency(f.cashToClose)}, debt service ${formatCurrency(f.monthlyDebtService)}/mo, cash flow ${formatCurrency(f.monthlyCashFlow)}/mo, DSCR ${formatRatio(f.dscr)}, cash-on-cash ${formatPercent(f.cashOnCashPct)}`,
          )
        : ["No scenarios saved."],
    },
    { heading: "Missing or unverified evidence", lines: s.evidenceGaps.length ? s.evidenceGaps.map((g) => `[${g.priority}] ${g.item} — ${g.whyItMatters}`) : ["None recorded."] },
  ];
  if (s.review) {
    const r = s.review.content;
    sections.push({
      heading: `Analyst review (${s.review.mode === "live" ? `live AI${s.review.model ? `, ${s.review.model}` : ""}` : "demo mode — deterministic, not live AI"})`,
      lines: [r.summary, "", ...r.risks.map((x) => `Risk [${x.severity}, ${x.basis.replace("_", " ")}]: ${x.title} — ${x.detail}`), "", r.plainLanguageSummary],
    });
  }
  sections.push({ heading: "Due-diligence checklist", lines: s.tasks.length ? s.tasks.map((t) => `[${t.status === "done" ? "x" : " "}] (${t.priority}) ${t.category}: ${t.title}`) : ["No tasks yet."] });
  sections.push({ heading: "Disclaimer", lines: [BRAND.disclaimer, u.exit.note] });
  return {
    title: `Investment report — ${s.dealName}`,
    subtitle: `Generated ${fmtDate(s.generatedAt)} by ${BRAND.name}`,
    banners: p.isSample ? [BRAND.sampleLabel] : [],
    sections,
    footer: `${BRAND.name} · Decision-support estimate · Verify independently`,
  };
}
