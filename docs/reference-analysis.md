# Reference analysis — DealPilot AI

_Last updated: 2026-10-21_

## What was actually available

The build prompt mentions three reference materials:

1. Tranchi AI public pages
2. A 12-minute, 42-second demo video
3. A Word document with a sample real estate app layout and embedded visuals

**None of them were in the repository or attached to the build session.** The only attachment in the repo (`.conversation/attached_assets/`) is the build prompt for the existing *Christ: The Scroll* app. No web pages were fetched, so no third-party marketing copy, layout or code was copied.

So this document can't claim to describe what those materials show. It records what the **build prompt itself** says about the reference workflow, keeps that separate from inference, and lists the product decisions made instead.

## 1. Directly visible (in the materials provided)

Only the prompt's own description of the reference workflow:

- Opportunity categories: on-market, probate, foreclosure, land bank, sheriff sale/auction, bank-owned/REO, motivated seller, tax deed/tax sale, land.
- A flow from discovering or importing a property → underwriting → financing comparison → AI explanation → due diligence → offer drafting → saved reports and a deal pipeline.
- A navy/blue, white and slate visual direction.

No screens, video frames, layout images or page text were available to check any of this against.

## 2. Inferred from the described workflow

- The reference product probably pairs a property search UI with an AI chat panel tied to the selected property.
- Category tabs probably filter one property feed rather than separate apps.
- "AI actions" in the reference may include automated outreach or offer sending. **This build deliberately does not do that.**

These are guesses from the prompt, not observations.

## 3. Unknown / cannot be verified

- Which data providers the reference uses for listings, probate, foreclosure, auction or tax-sale data, and under what licenses.
- Whether its AI uses live external data, and how it sources and timestamps facts.
- Its underwriting formulas, financing logic and defaults.
- Its document templates, pricing, authentication and data retention.
- Anything the video or Word document shows (screen layouts, copy, icons, imagery).

## 4. Original product decisions made for this build

| Area | Decision |
|---|---|
| Branding | Original name "DealPilot AI", set in one place (`lib/dealpilot-core/src/brand.ts`). Original logo (inline SVG) and system fonts. No third-party assets. |
| Data | No scraping and no unlicensed feeds. Sources are manual entry, user CSV import, and 10 fictional samples (invented streets/towns, unassigned `000xx` ZIPs) labelled **SAMPLE DATA — NOT REAL LISTINGS**. Category labels describe the opportunity type and never imply an official source. Every record carries a source status and capture timestamp. |
| Underwriting | A deterministic, unit-tested engine with every formula shown in the UI (`docs/financial-formulas.md`). |
| AI | A server-side adapter (Anthropic Claude). The model gets only validated deal data and must label each claim as calculated / user-supplied / assumption / unverified hypothesis. With no API key, a deterministic demo analyst runs and is labelled "Demo mode — not live AI". |
| Evidence | The user records what supports each key input (rent, taxes, insurance, rehab, value, inspection, title). Gaps drive both the analyst and the checklist. |
| Workflow | A persisted state machine (Queued → Running → Needs Input / Needs Review → Completed / Failed) with per-step output and retry. The LLM can't call tools or run code. |
| Offers | Draft-only, versioned, marked **DRAFT — NOT SUBMITTED**. No sending, e-signature or seller contact. |
| Accounts | Better Auth (email/password plus isolated anonymous demo workspaces). Ownership is checked on every private route. |

**Action for the product owner:** if the reference materials exist, add them to `docs/reference/` (or share them in the session) and this analysis can be redone against what they actually show.
