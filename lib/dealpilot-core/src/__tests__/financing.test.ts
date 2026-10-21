import { describe, expect, it } from "vitest";
import { computeFinancingScenario, defaultFinancingParams, FINANCING_DISCLAIMER } from "../financing";
import { FINANCING_KIND_IDS, FinancingParamsSchema } from "../schemas";
import { baseAssumptions } from "./fixtures";

const a = baseAssumptions();

describe("computeFinancingScenario", () => {
  it("cash purchase has no debt", () => {
    const r = computeFinancingScenario(a, defaultFinancingParams("cash"));
    expect(r.loans).toHaveLength(0);
    expect(r.downPayment).toBe(200000);
    expect(r.cashToClose).toBe(216000);
    expect(r.monthlyDebtService).toBe(0);
    expect(r.dscr).toBeNull();
    expect(r.monthlyCashFlow).toBe(1248);
  });

  it("conventional loan matches underwriting math", () => {
    const p = { ...defaultFinancingParams("conventional"), interestRatePct: 6, lenderFeesPct: 1 };
    const r = computeFinancingScenario(a, p);
    expect(r.totalLoanAmount).toBe(150000);
    expect(r.lenderFees).toBe(1500);
    expect(r.cashToClose).toBe(50000 + 6000 + 10000 + 1500);
    expect(r.monthlyDebtService).toBeCloseTo(899.33, 2);
    expect(r.dscr).toBeCloseTo(1.39, 2);
    expect(r.disclaimer).toBe(FINANCING_DISCLAIMER);
  });

  it("DSCR scenario warns when below the entered minimum", () => {
    const r = computeFinancingScenario(baseAssumptions({ monthlyRent: 1500 }), { ...defaultFinancingParams("dscr"), minDscr: 1.25 });
    expect(r.warnings.map((w) => w.code)).toContain("dscr_below_min");
  });

  it("seller financing computes a balloon balance", () => {
    const p = { ...defaultFinancingParams("seller"), downPaymentPct: 10, interestRatePct: 6, amortizationYears: 30, balloonYears: 5 };
    const r = computeFinancingScenario(a, p);
    expect(r.loans).toHaveLength(1);
    expect(r.loans[0].amount).toBe(180000);
    expect(r.loans[0].balloonBalance).toBeCloseTo(167497.84, 0);
    expect(r.lenderFees).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain("balloon_due");
  });

  it("hybrid splits bank and seller tranches and only charges lender fees on the bank loan", () => {
    const p = { ...defaultFinancingParams("hybrid"), downPaymentPct: 10, sellerCarryPct: 15, interestRatePct: 7, sellerRatePct: 5, lenderFeesPct: 1 };
    const r = computeFinancingScenario(a, p);
    expect(r.loans.map((l) => l.amount)).toEqual([150000, 30000]);
    expect(r.downPayment).toBe(20000);
    expect(r.lenderFees).toBe(1500);
    expect(r.monthlyDebtService).toBeCloseTo(997.95 + 161.05, 1);
  });

  it("hybrid errors when down + seller carry exceeds 100%", () => {
    const r = computeFinancingScenario(a, { ...defaultFinancingParams("hybrid"), downPaymentPct: 90, sellerCarryPct: 20 });
    expect(r.warnings.map((w) => w.code)).toContain("hybrid_over_100");
    expect(r.totalLoanAmount).toBeLessThanOrEqual(200000);
  });

  it("interest-only loans pay interest and balloon the full principal", () => {
    const r = computeFinancingScenario(a, { ...defaultFinancingParams("conventional"), interestRatePct: 6, interestOnly: true, balloonYears: 3 });
    expect(r.loans[0].monthlyPayment).toBe(750);
    expect(r.loans[0].balloonBalance).toBe(150000);
  });

  it("every default params object validates against the schema", () => {
    for (const kind of FINANCING_KIND_IDS) {
      expect(FinancingParamsSchema.safeParse(defaultFinancingParams(kind)).success).toBe(true);
    }
  });
});
