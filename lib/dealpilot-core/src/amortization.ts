/**
 * Loan math. Rates are annual percentages (6.5 means 6.5%), terms are in years,
 * payments are monthly. All functions return 0 instead of NaN/Infinity for
 * degenerate inputs so callers never render broken numbers.
 */

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

function isUsable(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** Fully amortizing monthly principal + interest payment. */
export function monthlyPayment(principal: number, annualRatePct: number, amortizationYears: number): number {
  if (!isUsable(principal) || !isUsable(amortizationYears) || !Number.isFinite(annualRatePct) || annualRatePct < 0) return 0;
  const n = Math.round(amortizationYears * 12);
  if (n <= 0) return 0;
  const r = monthlyRate(annualRatePct);
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

/** Interest-only monthly payment. */
export function interestOnlyPayment(principal: number, annualRatePct: number): number {
  if (!isUsable(principal) || !Number.isFinite(annualRatePct) || annualRatePct < 0) return 0;
  return principal * monthlyRate(annualRatePct);
}

/** Outstanding balance after `monthsPaid` payments on a fully amortizing loan. */
export function remainingBalance(principal: number, annualRatePct: number, amortizationYears: number, monthsPaid: number): number {
  if (!isUsable(principal)) return 0;
  const n = Math.round(amortizationYears * 12);
  if (n <= 0) return principal;
  const k = Math.max(0, Math.min(Math.round(monthsPaid), n));
  const r = monthlyRate(annualRatePct);
  if (!Number.isFinite(r) || r < 0) return principal;
  if (r === 0) return Math.max(0, principal - (principal / n) * k);
  const pmt = monthlyPayment(principal, annualRatePct, amortizationYears);
  const growth = (1 + r) ** k;
  return Math.max(0, principal * growth - pmt * ((growth - 1) / r));
}

export type AmortizationYear = {
  year: number;
  interestPaid: number;
  principalPaid: number;
  endingBalance: number;
};

/** Year-by-year amortization summary (fully amortizing loan). */
export function amortizationSchedule(principal: number, annualRatePct: number, amortizationYears: number, years?: number): AmortizationYear[] {
  const pmt = monthlyPayment(principal, annualRatePct, amortizationYears);
  if (pmt === 0) return [];
  const r = monthlyRate(annualRatePct);
  const totalYears = Math.min(years ?? amortizationYears, amortizationYears);
  const rows: AmortizationYear[] = [];
  let balance = principal;
  for (let year = 1; year <= totalYears; year++) {
    let interestPaid = 0;
    let principalPaid = 0;
    for (let m = 0; m < 12 && balance > 0; m++) {
      const interest = balance * r;
      const towardPrincipal = Math.min(pmt - interest, balance);
      interestPaid += interest;
      principalPaid += towardPrincipal;
      balance -= towardPrincipal;
    }
    rows.push({ year, interestPaid, principalPaid, endingBalance: Math.max(0, balance) });
  }
  return rows;
}
