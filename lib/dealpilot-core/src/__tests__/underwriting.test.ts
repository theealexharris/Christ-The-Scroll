import { describe, expect, it } from "vitest";
import { computeOperating, computeUnderwriting, defaultAssumptions, validateAssumptions } from "../underwriting";
import { baseAssumptions } from "./fixtures";

describe("computeOperating", () => {
  it("derives EGI, expenses and NOI", () => {
    const op = computeOperating(baseAssumptions());
    expect(op.grossScheduledIncomeMonthly).toBe(2000);
    expect(op.vacancyLossMonthly).toBe(100);
    expect(op.effectiveGrossIncomeMonthly).toBe(1900);
    expect(op.expenses.propertyTaxesMonthly).toBe(200);
    expect(op.expenses.insuranceMonthly).toBe(100);
    expect(op.expenses.maintenanceMonthly).toBe(100);
    expect(op.expenses.capexReserveMonthly).toBe(100);
    expect(op.expenses.managementMonthly).toBe(152);
    expect(op.operatingExpensesMonthly).toBe(652);
    expect(op.noiMonthly).toBe(1248);
    expect(op.noiAnnual).toBe(14976);
  });
});

describe("computeUnderwriting", () => {
  const r = computeUnderwriting(baseAssumptions());

  it("computes acquisition and cash required", () => {
    expect(r.acquisition.totalAcquisitionCost).toBe(216000);
    expect(r.acquisition.loanAmount).toBe(150000);
    expect(r.acquisition.downPayment).toBe(50000);
    expect(r.acquisition.totalCashRequired).toBe(66000);
  });

  it("computes debt service and cash flow", () => {
    expect(r.debt.monthlyDebtService).toBeCloseTo(899.33, 2);
    expect(r.cashFlow.monthly).toBeCloseTo(348.67, 2);
    expect(r.cashFlow.annual).toBeCloseTo(4184.08, 1);
  });

  it("computes return metrics", () => {
    expect(r.metrics.capRatePct).toBeCloseTo(7.49, 2);
    expect(r.metrics.capRateOnCostPct).toBeCloseTo(6.93, 2);
    expect(r.metrics.cashOnCashPct).toBeCloseTo(6.34, 2);
    expect(r.metrics.dscr).toBeCloseTo(1.39, 2);
    expect(r.metrics.breakEvenOccupancyPct).toBeCloseTo(76.05, 1);
    expect(r.metrics.grossRentMultiplier).toBeCloseTo(8.33, 2);
    expect(r.metrics.rentToPricePct).toBe(1);
  });

  it("documents every formula with a value and unit", () => {
    expect(r.formulas.length).toBeGreaterThan(10);
    for (const f of r.formulas) {
      expect(f.formula.length).toBeGreaterThan(5);
      expect(["usd", "usd_month", "usd_year", "pct", "ratio", "years"]).toContain(f.unit);
    }
  });

  it("projects an illustrative exit", () => {
    expect(r.exit.projectedValue).toBeCloseTo(200000 * 1.02 ** 5, 0);
    expect(r.exit.loanBalanceAtExit).toBeCloseTo(139581.53, 0);
    expect(r.exit.equityAtExit).toBeCloseTo(r.exit.projectedValue - r.exit.sellingCosts - r.exit.loanBalanceAtExit, 1);
    expect(r.exit.note).toMatch(/not a forecast/i);
  });

  it("handles a cash purchase with no debt", () => {
    const cash = computeUnderwriting(baseAssumptions({ useFinancing: false }));
    expect(cash.acquisition.loanAmount).toBe(0);
    expect(cash.debt.monthlyDebtService).toBe(0);
    expect(cash.metrics.dscr).toBeNull();
    expect(cash.acquisition.totalCashRequired).toBe(216000);
    expect(cash.cashFlow.monthly).toBe(1248);
  });

  it("returns nulls instead of dividing by zero", () => {
    const zero = computeUnderwriting(baseAssumptions({ purchasePrice: 0, monthlyRent: 0, closingCosts: 0, renovationCosts: 0 }));
    expect(zero.metrics.capRatePct).toBeNull();
    expect(zero.metrics.cashOnCashPct).toBeNull();
    expect(zero.metrics.grossRentMultiplier).toBeNull();
    expect(zero.metrics.rentToPricePct).toBeNull();
    expect(zero.metrics.breakEvenOccupancyPct).toBeNull();
    for (const v of Object.values(zero.metrics)) if (v !== null) expect(Number.isFinite(v)).toBe(true);
    expect(zero.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["price_missing", "rent_missing"]));
  });

  it("returns null break-even when management is 100%", () => {
    expect(computeUnderwriting(baseAssumptions({ managementPct: 100 })).metrics.breakEvenOccupancyPct).toBeNull();
  });

  it("flags negative cash flow, thin DSCR and balloons", () => {
    const bad = computeUnderwriting(baseAssumptions({ monthlyRent: 1200, loanTermYears: 5 }));
    const codes = bad.warnings.map((w) => w.code);
    expect(codes).toContain("negative_cash_flow");
    expect(codes).toContain("dscr_below_1");
    expect(codes).toContain("balloon");
  });
});

describe("validateAssumptions", () => {
  it("warns on missing taxes/insurance and implausible inputs", () => {
    const codes = validateAssumptions(baseAssumptions({ propertyTaxesAnnual: 0, insuranceAnnual: 0, vacancyRatePct: 0, interestRatePct: 18 })).map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["taxes_missing", "insurance_missing", "vacancy_zero", "rate_high"]));
  });
  it("does not warn on a clean deal", () => {
    expect(validateAssumptions(baseAssumptions()).filter((w) => w.severity !== "info")).toEqual([]);
  });
});

describe("defaultAssumptions", () => {
  it("seeds from the listing and marks evidence as estimates", () => {
    const a = defaultAssumptions({ listPrice: 100000, estimatedRentMonthly: 1200, annualTaxes: 1500 });
    expect(a.purchasePrice).toBe(100000);
    expect(a.closingCosts).toBe(3000);
    expect(a.evidence.rentSource).toBe("user_estimate");
    expect(a.evidence.insuranceSource).toBe("none");
  });
  it("models land without rent or financing", () => {
    const a = defaultAssumptions({ listPrice: 20000, estimatedRentMonthly: 500, propertyType: "land" });
    expect(a.monthlyRent).toBe(0);
    expect(a.useFinancing).toBe(false);
  });
});
