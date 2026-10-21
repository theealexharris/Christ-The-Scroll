import { interestOnlyPayment, monthlyPayment, remainingBalance } from "./amortization";
import { roundMoney, roundTo } from "./format";
import { FINANCING_KINDS, type DealAssumptions, type FinancingKind, type FinancingParams } from "./schemas";
import { computeOperating, type CalcWarning } from "./underwriting";

export type LoanTranche = {
  label: string;
  amount: number;
  ratePct: number;
  amortizationYears: number;
  interestOnly: boolean;
  balloonYears: number | null;
  monthlyPayment: number;
  balloonBalance: number | null;
};

export type FinancingResult = {
  kind: FinancingKind;
  name: string;
  loans: LoanTranche[];
  totalLoanAmount: number;
  downPayment: number;
  lenderFees: number;
  cashToClose: number;
  monthlyDebtService: number;
  annualDebtService: number;
  noiMonthly: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  dscr: number | null;
  cashOnCashPct: number | null;
  assumptions: string[];
  warnings: CalcWarning[];
  disclaimer: string;
};

export const FINANCING_DISCLAIMER =
  "Illustrative scenario only. This is not a loan offer, pre-approval or statement of eligibility. Actual terms depend on the lender or seller, your credit, the property and market conditions.";

/** Starting parameters for each scenario type. Users are expected to edit every figure. */
export function defaultFinancingParams(kind: FinancingKind, base?: Pick<DealAssumptions, "interestRatePct">): FinancingParams {
  const rate = base?.interestRatePct ?? 7.25;
  const name = FINANCING_KINDS.find((k) => k.id === kind)?.label ?? kind;
  const common = {
    kind,
    name,
    interestOnly: false,
    balloonYears: null,
    minDscr: null,
    sellerCarryPct: 0,
    sellerRatePct: 0,
    sellerAmortizationYears: 30,
    sellerBalloonYears: null,
    sellerInterestOnly: false,
  } satisfies Partial<FinancingParams>;
  switch (kind) {
    case "cash":
      return { ...common, downPaymentPct: 100, interestRatePct: 0, termYears: 0, amortizationYears: 0, lenderFeesPct: 0 };
    case "conventional":
      return { ...common, downPaymentPct: 25, interestRatePct: rate, termYears: 30, amortizationYears: 30, lenderFeesPct: 1 };
    case "dscr":
      return { ...common, downPaymentPct: 25, interestRatePct: roundTo(rate + 0.75, 2), termYears: 30, amortizationYears: 30, lenderFeesPct: 2, minDscr: 1.2 };
    case "seller":
      return { ...common, downPaymentPct: 10, interestRatePct: 6, termYears: 5, amortizationYears: 30, lenderFeesPct: 0, balloonYears: 5 };
    case "hybrid":
      return {
        ...common,
        downPaymentPct: 10,
        interestRatePct: rate,
        termYears: 30,
        amortizationYears: 30,
        lenderFeesPct: 1,
        sellerCarryPct: 15,
        sellerRatePct: 5,
        sellerAmortizationYears: 30,
        sellerBalloonYears: 5,
      };
  }
}

function tranche(label: string, amount: number, ratePct: number, amortYears: number, interestOnly: boolean, balloonYears: number | null): LoanTranche {
  const pmt = interestOnly ? interestOnlyPayment(amount, ratePct) : monthlyPayment(amount, ratePct, amortYears);
  const balloonBalance =
    balloonYears === null || amount <= 0 ? null : interestOnly ? amount : remainingBalance(amount, ratePct, amortYears, balloonYears * 12);
  return {
    label,
    amount: roundMoney(amount),
    ratePct,
    amortizationYears: amortYears,
    interestOnly,
    balloonYears,
    monthlyPayment: roundMoney(pmt),
    balloonBalance: balloonBalance === null ? null : roundMoney(balloonBalance),
  };
}

export function computeFinancingScenario(a: DealAssumptions, p: FinancingParams): FinancingResult {
  const price = a.purchasePrice;
  const warnings: CalcWarning[] = [];
  const assumptions: string[] = [];
  const loans: LoanTranche[] = [];

  const down = p.kind === "cash" ? 100 : p.downPaymentPct;
  const sellerPct = p.kind === "hybrid" ? p.sellerCarryPct : 0;
  if (p.kind === "hybrid" && down + sellerPct > 100) {
    warnings.push({ code: "hybrid_over_100", severity: "error", message: "Down payment plus seller carry exceeds 100% of the price." });
  }
  const firstPct = Math.max(0, 100 - down - sellerPct);

  if (p.kind === "conventional" || p.kind === "dscr" || p.kind === "hybrid") {
    const label = p.kind === "dscr" ? "DSCR-style loan" : p.kind === "hybrid" ? "Bank first lien" : "Investor loan";
    loans.push(tranche(label, price * (firstPct / 100), p.interestRatePct, p.amortizationYears, p.interestOnly, p.balloonYears));
  }
  if (p.kind === "seller") {
    loans.push(tranche("Seller note", price * (firstPct / 100), p.interestRatePct, p.amortizationYears, p.interestOnly, p.balloonYears));
  }
  if (p.kind === "hybrid" && sellerPct > 0) {
    loans.push(tranche("Seller carry (second)", price * (sellerPct / 100), p.sellerRatePct, p.sellerAmortizationYears, p.sellerInterestOnly, p.sellerBalloonYears));
  }

  const totalLoan = loans.reduce((s, l) => s + l.amount, 0);
  const downPayment = Math.max(0, price - totalLoan);
  const bankLoan = loans.filter((l) => !l.label.startsWith("Seller")).reduce((s, l) => s + l.amount, 0);
  const lenderFees = bankLoan * (p.lenderFeesPct / 100);
  const cashToClose = downPayment + a.closingCosts + a.renovationCosts + lenderFees;
  const monthlyDebtService = loans.reduce((s, l) => s + l.monthlyPayment, 0);
  const annualDebtService = monthlyDebtService * 12;

  const op = computeOperating(a);
  const monthlyCashFlow = op.noiMonthly - monthlyDebtService;
  const annualCashFlow = monthlyCashFlow * 12;
  const dscr = annualDebtService > 0 ? op.noiAnnual / annualDebtService : null;
  const coc = cashToClose > 0 ? annualCashFlow / cashToClose : null;

  assumptions.push(`Uses the deal's NOI of $${Math.round(op.noiMonthly).toLocaleString("en-US")}/month from the underwriting tab.`);
  assumptions.push(`Cash to close = down payment + closing costs ($${Math.round(a.closingCosts).toLocaleString("en-US")}) + renovation ($${Math.round(a.renovationCosts).toLocaleString("en-US")}) + lender fees.`);
  for (const l of loans) {
    assumptions.push(
      `${l.label}: ${l.ratePct}% ${l.interestOnly ? "interest-only" : `amortized over ${l.amortizationYears} yrs`}${l.balloonYears ? `, balloon due in year ${l.balloonYears}` : ""}.`,
    );
    if (l.balloonBalance !== null) {
      warnings.push({
        code: "balloon_due",
        severity: "info",
        message: `${l.label}: about $${Math.round(l.balloonBalance).toLocaleString("en-US")} is due as a balloon in year ${l.balloonYears}. Plan to refinance, sell or pay it off.`,
      });
    }
  }
  if (p.kind === "seller" || p.kind === "hybrid") {
    assumptions.push("Seller-financing terms are whatever you negotiate with the seller; confirm legality, due-on-sale clauses on existing liens, and documentation with an attorney.");
  }
  if (p.kind === "dscr" && p.minDscr !== null) {
    assumptions.push(`Illustrative minimum DSCR of ${p.minDscr.toFixed(2)}x. Actual lender requirements vary.`);
    if (dscr !== null && dscr < p.minDscr) {
      warnings.push({ code: "dscr_below_min", severity: "warning", message: `DSCR of ${dscr.toFixed(2)}x is below the illustrative ${p.minDscr.toFixed(2)}x minimum entered for this scenario.` });
    }
  }
  if (monthlyCashFlow < 0) warnings.push({ code: "negative_cash_flow", severity: "warning", message: "This scenario produces negative monthly cash flow." });
  for (const l of loans) {
    if (l.amount > 0 && !l.interestOnly && l.amortizationYears <= 0) {
      warnings.push({ code: "amort_missing", severity: "error", message: `${l.label}: enter an amortization period.` });
    }
  }

  return {
    kind: p.kind,
    name: p.name,
    loans,
    totalLoanAmount: roundMoney(totalLoan),
    downPayment: roundMoney(downPayment),
    lenderFees: roundMoney(lenderFees),
    cashToClose: roundMoney(cashToClose),
    monthlyDebtService: roundMoney(monthlyDebtService),
    annualDebtService: roundMoney(annualDebtService),
    noiMonthly: op.noiMonthly,
    monthlyCashFlow: roundMoney(monthlyCashFlow),
    annualCashFlow: roundMoney(annualCashFlow),
    dscr: dscr === null ? null : roundTo(dscr, 2),
    cashOnCashPct: coc === null ? null : roundTo(coc * 100, 2),
    assumptions,
    warnings,
    disclaimer: FINANCING_DISCLAIMER,
  };
}
