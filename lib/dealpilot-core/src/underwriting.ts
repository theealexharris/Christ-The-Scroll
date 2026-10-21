import { monthlyPayment, remainingBalance } from "./amortization";
import { roundMoney, roundTo } from "./format";
import type { DealAssumptions } from "./schemas";

export type WarningSeverity = "error" | "warning" | "info";

export type CalcWarning = {
  code: string;
  severity: WarningSeverity;
  field?: keyof DealAssumptions;
  message: string;
};

export type FormulaLine = {
  key: string;
  label: string;
  formula: string;
  value: number | null;
  unit: "usd" | "usd_month" | "usd_year" | "pct" | "ratio" | "years";
};

export type OperatingSummary = {
  grossScheduledIncomeMonthly: number;
  vacancyLossMonthly: number;
  effectiveGrossIncomeMonthly: number;
  expenses: {
    propertyTaxesMonthly: number;
    insuranceMonthly: number;
    hoaMonthly: number;
    maintenanceMonthly: number;
    capexReserveMonthly: number;
    managementMonthly: number;
    utilitiesMonthly: number;
    otherMonthly: number;
  };
  operatingExpensesMonthly: number;
  noiMonthly: number;
  noiAnnual: number;
};

export type UnderwritingResult = {
  acquisition: {
    purchasePrice: number;
    closingCosts: number;
    renovationCosts: number;
    totalAcquisitionCost: number;
    downPayment: number;
    loanAmount: number;
    loanFees: number;
    totalCashRequired: number;
  };
  operating: OperatingSummary;
  debt: {
    monthlyDebtService: number;
    annualDebtService: number;
  };
  cashFlow: {
    monthly: number;
    annual: number;
  };
  metrics: {
    capRatePct: number | null;
    capRateOnCostPct: number | null;
    cashOnCashPct: number | null;
    dscr: number | null;
    breakEvenOccupancyPct: number | null;
    expenseRatioPct: number | null;
    grossRentMultiplier: number | null;
    rentToPricePct: number | null;
  };
  exit: {
    holdYears: number;
    baseValue: number;
    projectedValue: number;
    sellingCosts: number;
    loanBalanceAtExit: number;
    equityAtExit: number;
    cumulativeCashFlow: number;
    totalProfit: number;
    note: string;
  };
  formulas: FormulaLine[];
  warnings: CalcWarning[];
};

const safeDiv = (num: number, den: number): number | null => (den > 0 && Number.isFinite(num) ? num / den : null);

/** Income and operating expenses. Independent of financing. */
export function computeOperating(a: DealAssumptions): OperatingSummary {
  const gsi = a.monthlyRent + a.otherMonthlyIncome;
  const vacancy = gsi * (a.vacancyRatePct / 100);
  const egi = gsi - vacancy;
  const expenses = {
    propertyTaxesMonthly: a.propertyTaxesAnnual / 12,
    insuranceMonthly: a.insuranceAnnual / 12,
    hoaMonthly: a.hoaMonthly,
    maintenanceMonthly: a.monthlyRent * (a.maintenancePct / 100),
    capexReserveMonthly: a.monthlyRent * (a.capexReservePct / 100),
    managementMonthly: egi * (a.managementPct / 100),
    utilitiesMonthly: a.utilitiesMonthly,
    otherMonthly: a.otherExpensesMonthly,
  };
  const opex = Object.values(expenses).reduce((sum, v) => sum + v, 0);
  const noiMonthly = egi - opex;
  return {
    grossScheduledIncomeMonthly: roundMoney(gsi),
    vacancyLossMonthly: roundMoney(vacancy),
    effectiveGrossIncomeMonthly: roundMoney(egi),
    expenses: Object.fromEntries(Object.entries(expenses).map(([k, v]) => [k, roundMoney(v)])) as OperatingSummary["expenses"],
    operatingExpensesMonthly: roundMoney(opex),
    noiMonthly: roundMoney(noiMonthly),
    noiAnnual: roundMoney(noiMonthly * 12),
  };
}

/** Operating expenses that do not scale with occupancy (everything except management). */
function fixedOperatingExpensesMonthly(op: OperatingSummary): number {
  return op.operatingExpensesMonthly - op.expenses.managementMonthly;
}

export function computeUnderwriting(a: DealAssumptions): UnderwritingResult {
  const warnings = validateAssumptions(a);
  const op = computeOperating(a);

  const loanAmount = a.useFinancing ? a.purchasePrice * (1 - a.downPaymentPct / 100) : 0;
  const downPayment = a.purchasePrice - loanAmount;
  const loanFees = a.useFinancing ? a.loanFees : 0;
  const totalAcquisitionCost = a.purchasePrice + a.closingCosts + a.renovationCosts;
  const totalCashRequired = downPayment + a.closingCosts + a.renovationCosts + loanFees;

  const monthlyDebtService = a.useFinancing ? monthlyPayment(loanAmount, a.interestRatePct, a.amortizationYears) : 0;
  const annualDebtService = monthlyDebtService * 12;
  const cashFlowMonthly = op.noiMonthly - monthlyDebtService;
  const cashFlowAnnual = cashFlowMonthly * 12;

  const grossAnnualRent = a.monthlyRent * 12;
  const capRate = safeDiv(op.noiAnnual, a.purchasePrice);
  const capRateOnCost = safeDiv(op.noiAnnual, totalAcquisitionCost);
  const coc = safeDiv(cashFlowAnnual, totalCashRequired);
  const dscr = annualDebtService > 0 ? op.noiAnnual / annualDebtService : null;
  const mgmtShare = a.managementPct / 100;
  const breakEven =
    op.grossScheduledIncomeMonthly > 0 && mgmtShare < 1
      ? (fixedOperatingExpensesMonthly(op) + monthlyDebtService) / (op.grossScheduledIncomeMonthly * (1 - mgmtShare))
      : null;
  const expenseRatio = safeDiv(op.operatingExpensesMonthly, op.effectiveGrossIncomeMonthly);
  const grm = safeDiv(a.purchasePrice, grossAnnualRent);
  const rentToPrice = safeDiv(a.monthlyRent, a.purchasePrice);

  // Exit scenario: flat rents, constant appreciation, loan amortizes on schedule.
  const baseValue = a.afterRepairValue ?? a.purchasePrice;
  const projectedValue = baseValue * (1 + a.annualAppreciationPct / 100) ** a.holdYears;
  const sellingCosts = projectedValue * (a.sellingCostsPct / 100);
  const loanBalanceAtExit = a.useFinancing ? remainingBalance(loanAmount, a.interestRatePct, a.amortizationYears, a.holdYears * 12) : 0;
  const equityAtExit = projectedValue - sellingCosts - loanBalanceAtExit;
  const cumulativeCashFlow = cashFlowAnnual * a.holdYears;
  const totalProfit = equityAtExit + cumulativeCashFlow - totalCashRequired;

  if (breakEven !== null && breakEven > 1) {
    warnings.push({
      code: "break_even_over_100",
      severity: "warning",
      message: "Break-even occupancy is above 100%: the property cannot cover expenses and debt service even when fully rented.",
    });
  }
  if (cashFlowMonthly < 0) {
    warnings.push({ code: "negative_cash_flow", severity: "warning", message: "Projected monthly cash flow is negative under these assumptions." });
  }
  if (dscr !== null && dscr < 1) {
    warnings.push({ code: "dscr_below_1", severity: "warning", message: "DSCR is below 1.00x: net operating income does not cover debt service." });
  } else if (dscr !== null && dscr < 1.2) {
    warnings.push({ code: "dscr_thin", severity: "info", message: "DSCR is below 1.20x, a level many DSCR-style lenders use as a minimum. Thresholds vary by lender." });
  }
  if (capRate !== null && capRate > 0.15) {
    warnings.push({ code: "cap_rate_high", severity: "warning", message: "Cap rate above 15% is unusual. Double-check rent, expenses and price." });
  }
  if (a.useFinancing && monthlyDebtService > 0 && a.loanTermYears < a.amortizationYears) {
    warnings.push({
      code: "balloon",
      severity: "info",
      field: "loanTermYears",
      message: `Loan term (${a.loanTermYears} yrs) is shorter than amortization (${a.amortizationYears} yrs): a balloon payment of about $${Math.round(
        remainingBalance(loanAmount, a.interestRatePct, a.amortizationYears, a.loanTermYears * 12),
      ).toLocaleString("en-US")} would be due at maturity.`,
    });
  }

  const pct = (v: number | null) => (v === null ? null : roundTo(v * 100, 2));
  const metrics = {
    capRatePct: pct(capRate),
    capRateOnCostPct: pct(capRateOnCost),
    cashOnCashPct: pct(coc),
    dscr: dscr === null ? null : roundTo(dscr, 2),
    breakEvenOccupancyPct: pct(breakEven),
    expenseRatioPct: pct(expenseRatio),
    grossRentMultiplier: grm === null ? null : roundTo(grm, 2),
    rentToPricePct: pct(rentToPrice),
  };

  const result: UnderwritingResult = {
    acquisition: {
      purchasePrice: roundMoney(a.purchasePrice),
      closingCosts: roundMoney(a.closingCosts),
      renovationCosts: roundMoney(a.renovationCosts),
      totalAcquisitionCost: roundMoney(totalAcquisitionCost),
      downPayment: roundMoney(downPayment),
      loanAmount: roundMoney(loanAmount),
      loanFees: roundMoney(loanFees),
      totalCashRequired: roundMoney(totalCashRequired),
    },
    operating: op,
    debt: { monthlyDebtService: roundMoney(monthlyDebtService), annualDebtService: roundMoney(annualDebtService) },
    cashFlow: { monthly: roundMoney(cashFlowMonthly), annual: roundMoney(cashFlowAnnual) },
    metrics,
    exit: {
      holdYears: a.holdYears,
      baseValue: roundMoney(baseValue),
      projectedValue: roundMoney(projectedValue),
      sellingCosts: roundMoney(sellingCosts),
      loanBalanceAtExit: roundMoney(loanBalanceAtExit),
      equityAtExit: roundMoney(equityAtExit),
      cumulativeCashFlow: roundMoney(cumulativeCashFlow),
      totalProfit: roundMoney(totalProfit),
      note: "Illustrative only: assumes flat rents and expenses, constant appreciation and scheduled amortization. Not a forecast or guarantee.",
    },
    formulas: [],
    warnings,
  };
  result.formulas = buildFormulas(result);
  return result;
}

function buildFormulas(r: UnderwritingResult): FormulaLine[] {
  return [
    { key: "total_acquisition", label: "Total acquisition cost", formula: "Purchase price + closing costs + renovation costs", value: r.acquisition.totalAcquisitionCost, unit: "usd" },
    { key: "loan_amount", label: "Loan amount", formula: "Purchase price × (1 − down payment %)", value: r.acquisition.loanAmount, unit: "usd" },
    { key: "cash_required", label: "Total cash required", formula: "Down payment + closing costs + renovation costs + loan fees", value: r.acquisition.totalCashRequired, unit: "usd" },
    { key: "gsi", label: "Gross scheduled income", formula: "Monthly rent + other monthly income", value: r.operating.grossScheduledIncomeMonthly, unit: "usd_month" },
    { key: "egi", label: "Effective gross income", formula: "Gross scheduled income × (1 − vacancy %)", value: r.operating.effectiveGrossIncomeMonthly, unit: "usd_month" },
    {
      key: "opex",
      label: "Operating expenses",
      formula: "Taxes/12 + insurance/12 + HOA + rent × maintenance % + rent × capex % + EGI × management % + utilities + other",
      value: r.operating.operatingExpensesMonthly,
      unit: "usd_month",
    },
    { key: "noi", label: "Net operating income (NOI)", formula: "Effective gross income − operating expenses (before debt service)", value: r.operating.noiAnnual, unit: "usd_year" },
    { key: "debt_service", label: "Debt service", formula: "P × r / (1 − (1 + r)^−n), r = annual rate / 12, n = amortization years × 12", value: r.debt.monthlyDebtService, unit: "usd_month" },
    { key: "cash_flow", label: "Cash flow", formula: "NOI − debt service", value: r.cashFlow.monthly, unit: "usd_month" },
    { key: "cap_rate", label: "Cap rate", formula: "Annual NOI ÷ purchase price", value: r.metrics.capRatePct, unit: "pct" },
    { key: "cap_rate_cost", label: "Cap rate on total cost", formula: "Annual NOI ÷ total acquisition cost", value: r.metrics.capRateOnCostPct, unit: "pct" },
    { key: "coc", label: "Cash-on-cash return", formula: "Annual cash flow ÷ total cash required", value: r.metrics.cashOnCashPct, unit: "pct" },
    { key: "dscr", label: "Debt service coverage ratio", formula: "Annual NOI ÷ annual debt service", value: r.metrics.dscr, unit: "ratio" },
    {
      key: "break_even",
      label: "Break-even occupancy",
      formula: "(Non-management expenses + debt service) ÷ (gross scheduled income × (1 − management %))",
      value: r.metrics.breakEvenOccupancyPct,
      unit: "pct",
    },
    { key: "expense_ratio", label: "Operating expense ratio", formula: "Operating expenses ÷ effective gross income", value: r.metrics.expenseRatioPct, unit: "pct" },
    { key: "grm", label: "Gross rent multiplier", formula: "Purchase price ÷ annual gross rent", value: r.metrics.grossRentMultiplier, unit: "ratio" },
    {
      key: "equity_exit",
      label: `Estimated equity at year ${r.exit.holdYears}`,
      formula: "Base value × (1 + appreciation %)^years − selling costs − remaining loan balance",
      value: r.exit.equityAtExit,
      unit: "usd",
    },
  ];
}

/** Input sanity checks that do not depend on computed results. */
export function validateAssumptions(a: DealAssumptions): CalcWarning[] {
  const w: CalcWarning[] = [];
  if (a.purchasePrice <= 0) w.push({ code: "price_missing", severity: "error", field: "purchasePrice", message: "Enter a purchase price to calculate returns." });
  else if (a.purchasePrice < 10_000) w.push({ code: "price_low", severity: "warning", field: "purchasePrice", message: "Purchase price under $10,000 is unusual. Confirm the figure." });
  if (a.monthlyRent <= 0) w.push({ code: "rent_missing", severity: "error", field: "monthlyRent", message: "Enter expected monthly rent. Income-based metrics cannot be calculated without it." });
  if (a.purchasePrice > 0 && a.monthlyRent / a.purchasePrice > 0.03)
    w.push({ code: "rent_ratio_high", severity: "warning", field: "monthlyRent", message: "Monthly rent above 3% of price is rare. Verify the rent estimate." });
  if (a.vacancyRatePct === 0) w.push({ code: "vacancy_zero", severity: "info", field: "vacancyRatePct", message: "0% vacancy is optimistic. Most investors budget for some turnover." });
  if (a.vacancyRatePct > 50) w.push({ code: "vacancy_high", severity: "warning", field: "vacancyRatePct", message: "Vacancy above 50% is unusual for a stabilized property." });
  if (a.propertyTaxesAnnual === 0) w.push({ code: "taxes_missing", severity: "warning", field: "propertyTaxesAnnual", message: "Property taxes are $0. Look up the tax record; most properties pay property tax." });
  if (a.insuranceAnnual === 0) w.push({ code: "insurance_missing", severity: "warning", field: "insuranceAnnual", message: "Insurance is $0. Get a quote before relying on these numbers." });
  if (a.maintenancePct + a.capexReservePct === 0)
    w.push({ code: "no_reserves", severity: "info", field: "maintenancePct", message: "No maintenance or capital-expenditure reserve is budgeted." });
  if (a.useFinancing) {
    if (a.downPaymentPct >= 100) w.push({ code: "down_100", severity: "info", field: "downPaymentPct", message: "Down payment is 100%, so there is no loan. Turn off financing to model a cash purchase." });
    if (a.interestRatePct === 0) w.push({ code: "rate_zero", severity: "warning", field: "interestRatePct", message: "Interest rate is 0%. Enter the rate you expect to be quoted." });
    if (a.interestRatePct > 15) w.push({ code: "rate_high", severity: "warning", field: "interestRatePct", message: "Interest rate above 15% is unusually high. Confirm the figure." });
    if (a.amortizationYears <= 0 && a.downPaymentPct < 100) w.push({ code: "amort_missing", severity: "error", field: "amortizationYears", message: "Enter an amortization period for the loan." });
    if (a.loanTermYears <= 0 && a.downPaymentPct < 100) w.push({ code: "term_missing", severity: "warning", field: "loanTermYears", message: "Enter the loan term." });
  }
  if (a.afterRepairValue !== null && a.afterRepairValue > 0 && a.afterRepairValue < a.purchasePrice + a.renovationCosts) {
    w.push({ code: "arv_below_cost", severity: "info", field: "afterRepairValue", message: "After-repair value is below purchase price plus renovation costs." });
  }
  return w;
}

/** Reasonable starting assumptions for a property. Users should replace them with verified figures. */
export function defaultAssumptions(input: {
  listPrice?: number | null;
  estimatedRentMonthly?: number | null;
  annualTaxes?: number | null;
  propertyType?: string;
  preferences?: { defaultVacancyRatePct?: number; defaultInterestRatePct?: number; defaultDownPaymentPct?: number };
}): DealAssumptions {
  const price = input.listPrice ?? 0;
  const isLand = input.propertyType === "land";
  return {
    purchasePrice: price,
    closingCosts: roundMoney(price * 0.03),
    renovationCosts: 0,
    afterRepairValue: null,
    monthlyRent: isLand ? 0 : (input.estimatedRentMonthly ?? 0),
    otherMonthlyIncome: 0,
    vacancyRatePct: input.preferences?.defaultVacancyRatePct ?? 6,
    propertyTaxesAnnual: input.annualTaxes ?? 0,
    insuranceAnnual: 0,
    hoaMonthly: 0,
    maintenancePct: isLand ? 0 : 5,
    capexReservePct: isLand ? 0 : 5,
    managementPct: isLand ? 0 : 8,
    utilitiesMonthly: 0,
    otherExpensesMonthly: 0,
    useFinancing: !isLand,
    downPaymentPct: input.preferences?.defaultDownPaymentPct ?? 25,
    interestRatePct: input.preferences?.defaultInterestRatePct ?? 7.25,
    loanTermYears: 30,
    amortizationYears: 30,
    loanFees: 0,
    holdYears: 5,
    annualAppreciationPct: 2,
    sellingCostsPct: 6,
    evidence: {
      rentSource: input.estimatedRentMonthly ? "user_estimate" : "none",
      taxSource: input.annualTaxes ? "user_estimate" : "none",
      insuranceSource: "none",
      rehabSource: "none",
      valueSource: "none",
      inspectionCompleted: false,
      titleSearchCompleted: false,
    },
  };
}
