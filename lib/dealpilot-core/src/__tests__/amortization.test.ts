import { describe, expect, it } from "vitest";
import { amortizationSchedule, interestOnlyPayment, monthlyPayment, remainingBalance } from "../amortization";

describe("monthlyPayment", () => {
  it("matches the standard 30-year mortgage payment", () => {
    expect(monthlyPayment(200000, 6, 30)).toBeCloseTo(1199.1, 2);
    expect(monthlyPayment(150000, 7.25, 30)).toBeCloseTo(1023.26, 2);
  });
  it("handles a 0% rate as straight-line principal", () => {
    expect(monthlyPayment(120000, 0, 10)).toBeCloseTo(1000, 6);
  });
  it("returns 0 for degenerate inputs instead of NaN/Infinity", () => {
    expect(monthlyPayment(0, 6, 30)).toBe(0);
    expect(monthlyPayment(100000, 6, 0)).toBe(0);
    expect(monthlyPayment(-5, 6, 30)).toBe(0);
    expect(monthlyPayment(100000, -1, 30)).toBe(0);
    expect(monthlyPayment(Number.NaN, 6, 30)).toBe(0);
  });
});

describe("interestOnlyPayment", () => {
  it("is principal × monthly rate", () => {
    expect(interestOnlyPayment(100000, 6)).toBeCloseTo(500, 6);
    expect(interestOnlyPayment(0, 6)).toBe(0);
  });
});

describe("remainingBalance", () => {
  it("matches a known balance after 5 years", () => {
    expect(remainingBalance(200000, 6, 30, 60)).toBeCloseTo(186108.71, 0);
  });
  it("is zero at maturity and principal at month 0", () => {
    expect(remainingBalance(200000, 6, 30, 360)).toBeCloseTo(0, 4);
    expect(remainingBalance(200000, 6, 30, 0)).toBeCloseTo(200000, 6);
  });
  it("handles 0% rate", () => {
    expect(remainingBalance(120000, 0, 10, 60)).toBeCloseTo(60000, 6);
  });
  it("clamps months beyond the term", () => {
    expect(remainingBalance(100000, 5, 10, 999)).toBeCloseTo(0, 4);
  });
});

describe("amortizationSchedule", () => {
  it("principal paid sums to the loan and ending balance reaches 0", () => {
    const rows = amortizationSchedule(100000, 5, 15);
    expect(rows).toHaveLength(15);
    const principal = rows.reduce((s, r) => s + r.principalPaid, 0);
    expect(principal).toBeCloseTo(100000, 2);
    expect(rows.at(-1)!.endingBalance).toBeCloseTo(0, 2);
    expect(rows[0].endingBalance).toBeCloseTo(remainingBalance(100000, 5, 15, 12), 2);
  });
  it("returns an empty schedule for no loan", () => {
    expect(amortizationSchedule(0, 5, 30)).toEqual([]);
  });
});
