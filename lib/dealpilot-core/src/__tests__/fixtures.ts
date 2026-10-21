import { DealAssumptionsSchema, type DealAssumptions } from "../schemas";
import type { PropertyFacts } from "../evidence";

export function baseAssumptions(overrides: Partial<DealAssumptions> = {}): DealAssumptions {
  return DealAssumptionsSchema.parse({
    purchasePrice: 200000,
    closingCosts: 6000,
    renovationCosts: 10000,
    afterRepairValue: null,
    monthlyRent: 2000,
    otherMonthlyIncome: 0,
    vacancyRatePct: 5,
    propertyTaxesAnnual: 2400,
    insuranceAnnual: 1200,
    hoaMonthly: 0,
    maintenancePct: 5,
    capexReservePct: 5,
    managementPct: 8,
    utilitiesMonthly: 0,
    otherExpensesMonthly: 0,
    useFinancing: true,
    downPaymentPct: 25,
    interestRatePct: 6,
    loanTermYears: 30,
    amortizationYears: 30,
    loanFees: 0,
    ...overrides,
  });
}

export function baseProperty(overrides: Partial<PropertyFacts> = {}): PropertyFacts {
  return {
    title: "Test duplex",
    addressLine: "1 Test St",
    city: "Testville",
    state: "OH",
    category: "on_market",
    propertyType: "multi_family",
    sourceStatus: "manual_entry",
    isSample: false,
    listPrice: 200000,
    units: 2,
    beds: 4,
    baths: 2,
    squareFeet: 1800,
    yearBuilt: 1990,
    description: null,
    sourceName: null,
    sourceRetrievedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}
