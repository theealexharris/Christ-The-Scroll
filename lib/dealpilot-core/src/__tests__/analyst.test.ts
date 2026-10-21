import { describe, expect, it } from "vitest";
import { AiReviewSchema, answerQuestionDemo, buildDemoReview, serializeContextForModel } from "../analyst";
import { generateDueDiligenceTasks } from "../due-diligence";
import { findEvidenceGaps } from "../evidence";
import { computeFinancingScenario, defaultFinancingParams } from "../financing";
import { computeUnderwriting } from "../underwriting";
import { baseAssumptions, baseProperty } from "./fixtures";

function ctx(overrides: Parameters<typeof baseProperty>[0] = {}, a = baseAssumptions()) {
  return {
    property: baseProperty(overrides),
    assumptions: a,
    underwriting: computeUnderwriting(a),
    financing: [computeFinancingScenario(a, defaultFinancingParams("cash")), computeFinancingScenario(a, defaultFinancingParams("conventional"))],
  };
}

describe("evidence gaps", () => {
  it("flags unverified rent, value, inspection and title by default", () => {
    const keys = findEvidenceGaps(baseProperty(), baseAssumptions()).map((g) => g.key);
    expect(keys).toEqual(expect.arrayContaining(["rent", "value", "inspection", "title", "insurance", "taxes"]));
    expect(keys).not.toContain("sample_data");
  });
  it("clears gaps once evidence is recorded", () => {
    const a = baseAssumptions({
      evidence: { rentSource: "signed_lease", taxSource: "tax_record", insuranceSource: "written_quote", rehabSource: "contractor_bid", valueSource: "appraisal", inspectionCompleted: true, titleSearchCompleted: true },
    });
    expect(findEvidenceGaps(baseProperty(), a)).toEqual([]);
  });
  it("always flags sample data", () => {
    expect(findEvidenceGaps(baseProperty({ isSample: true, sourceStatus: "demo" }), baseAssumptions())[0].key).toBe("sample_data");
  });
});

describe("due diligence", () => {
  it("adds category- and type-specific tasks without duplicates", () => {
    const tasks = generateDueDiligenceTasks(baseProperty({ category: "sheriff_sale" }), baseAssumptions());
    const keys = tasks.map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(["auction_terms", "redemption", "rent_roll", "inspection"]));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("adds land tasks and omits building inspection for land", () => {
    const keys = generateDueDiligenceTasks(baseProperty({ propertyType: "land", category: "land_bank", units: null }), baseAssumptions()).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(["survey", "utilities_access", "land_bank_program"]));
    expect(keys).not.toContain("inspection");
  });
  it("drops tasks whose evidence is already recorded", () => {
    const a = baseAssumptions({ evidence: { rentSource: "none", taxSource: "none", insuranceSource: "none", rehabSource: "none", valueSource: "none", inspectionCompleted: true, titleSearchCompleted: true } });
    const keys = generateDueDiligenceTasks(baseProperty(), a).map((t) => t.key);
    expect(keys).not.toContain("inspection");
    expect(keys).not.toContain("title_search");
  });
  it("adds a lead-paint task for pre-1978 buildings", () => {
    expect(generateDueDiligenceTasks(baseProperty({ yearBuilt: 1950 }), baseAssumptions()).map((t) => t.key)).toContain("lead_paint");
  });
});

describe("demo analyst", () => {
  it("produces a schema-valid review grounded in calculated numbers", () => {
    const review = buildDemoReview(ctx());
    expect(AiReviewSchema.safeParse(review).success).toBe(true);
    expect(review.summary).toContain("$200,000");
    expect(review.metricExplanations.every((m) => m.basis === "calculated")).toBe(true);
    expect(review.missingEvidence.length).toBeGreaterThan(0);
  });
  it("labels sample data in every answer", () => {
    const c = ctx({ isSample: true, sourceStatus: "demo" });
    expect(buildDemoReview(c).summary.startsWith("This is fictional SAMPLE data.")).toBe(true);
    expect(answerQuestionDemo("what is the cap rate?", c).answer).toMatch(/^This is fictional SAMPLE data/);
  });
  it("routes questions deterministically", () => {
    const c = ctx();
    expect(answerQuestionDemo("Explain the cap rate", c).answer).toMatch(/Annual NOI/);
    expect(answerQuestionDemo("What's the DSCR?", c).answer).toMatch(/covers debt service/);
    expect(answerQuestionDemo("How do financing options compare?", c).answer).toMatch(/scenario/);
    expect(answerQuestionDemo("What evidence is missing?", c).answer).toMatch(/rent/i);
  });
  it("refuses to invent external facts", () => {
    const a = answerQuestionDemo("What are the comparable sales and zoning?", ctx());
    expect(a.basis).toBe("unverified_hypothesis");
    expect(a.answer).toMatch(/no access to external data/);
  });
  it("is identical across runs", () => {
    expect(buildDemoReview(ctx())).toEqual(buildDemoReview(ctx()));
  });
  it("serializes only structured context", () => {
    const json = JSON.parse(serializeContextForModel(ctx()));
    expect(json.underwriting.metrics.capRatePct).toBeCloseTo(7.49, 2);
    expect(json.financingScenarios).toHaveLength(2);
  });
});
