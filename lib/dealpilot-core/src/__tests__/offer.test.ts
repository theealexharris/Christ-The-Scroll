import { describe, expect, it } from "vitest";
import { BRAND } from "../brand";
import { buildOfferSections, defaultOfferTerms, OfferTermsSchema } from "../offer";

describe("offer drafts", () => {
  it("defaults to a valid draft with placeholders", () => {
    const t = defaultOfferTerms({ address: "1 Test St, Testville, OH", price: 150000, financing: true });
    expect(OfferTermsSchema.safeParse(t).success).toBe(true);
    expect(t.earnestMoney).toBe(1500);
    expect(t.buyerName).toBe("[Buyer name]");
  });
  it("always marks sections as draft-only with the disclaimer", () => {
    const sections = buildOfferSections(defaultOfferTerms({ address: "x", price: 1, financing: false }), 3);
    expect(sections[0].lines[0]).toBe(`${BRAND.draftLabel} · Version 3`);
    expect(sections.at(-1)!.lines[0]).toBe(BRAND.disclaimer);
  });
  it("rejects malformed dates", () => {
    const t = { ...defaultOfferTerms({ address: "x", price: 1, financing: false }), closingDate: "next week" };
    expect(OfferTermsSchema.safeParse(t).success).toBe(false);
  });
});
