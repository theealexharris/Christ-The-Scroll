# Demo video production plan (3–5 minutes)

**Status:** plan only. **No video has been rendered.** The video must show the working app, with fictional data labelled on screen.

## Setup

- Deploy or run locally with `DEALPILOT_ALLOW_DEMO_ACCOUNTS=true`. Use a fresh demo workspace so there's no personal data.
- Decide on AI mode. If `ANTHROPIC_API_KEY` is set, the narration says "live AI". If not, it must say "demo mode", and the "Demo mode — not live AI" badge must stay visible.
- Record at 1920×1080, browser zoom 110%, cursor highlighting on. Do one extra take at phone width for the mobile segment.

## Script and shot list

| # | Time | Screen | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:15 | Sign-in page → "Try a demo workspace" | "DealPilot AI helps you underwrite a real estate deal with transparent math, and an AI analyst that shows its work." |
| 2 | 0:15–0:40 | Discover: category chips, data-source callout, a filter for "duplex" | "Browse by opportunity type. Every record shows where it came from. These are fictional samples, clearly labelled. No listing feed is connected in this demo." |
| 3 | 0:40–1:05 | Card → Analyze → deal overview metrics | "Save a property as a deal and you immediately see cash flow, cap rate, cash-on-cash, DSCR and cash required." |
| 4 | 1:05–1:45 | Underwriting: edit insurance and vacancy, watch the metrics update, scroll to Formulas, Save (version 2) | "Every assumption is editable, and every result comes with its formula. Saving creates a versioned snapshot." |
| 5 | 1:45–2:20 | Financing: add a seller-financing scenario, compare the table, point at the balloon warning | "Compare cash, conventional, DSCR-style, seller and hybrid structures side by side. These are illustrations, not loan offers." |
| 6 | 2:20–3:00 | Overview: Run analysis → step list → "Ready for your review"; AI analyst tab, basis badges, ask "What evidence is missing?" | "The workflow validates inputs, runs the math, asks the analyst to explain it and flags missing evidence. Every statement is labelled calculated, assumption or unverified." |
| 7 | 3:00–3:25 | Due diligence: generated tasks, tick one | "A checklist built for this property type and deal category." |
| 8 | 3:25–3:55 | Offer: enter the buyer name, save version 1, export PDF; Reports tab | "Draft an offer summary for your agent or attorney. It's always marked draft, never sent." |
| 9 | 3:55–4:15 | Mobile: hamburger menu → Discover | "It works on your phone too." |
| 10 | 4:15–4:30 | Disclaimer card + logo | "DealPilot is decision support. Verify everything independently before you act." |

## Captions and transitions

- Burn in captions (SRT generated from the voiceover above; up to 42 characters per line, 2 lines).
- Keep the on-screen labels "SAMPLE DATA — NOT REAL LISTINGS" and "DRAFT — NOT SUBMITTED" readable, and don't crop them.
- Transitions: 200 ms cross-dissolves between segments, and zoom-ins on the formulas table and basis badges.

## Avatar and voice options

| Option | Notes |
|---|---|
| Real presenter (screen + face cam) | Most credible. Needs a signed appearance release |
| Licensed AI avatar (e.g. Synthesia, HeyGen) | Use a stock avatar under the vendor's commercial license; no likeness of a real person without written consent |
| Synthetic voice (e.g. ElevenLabs stock voice) | Use stock voices only. No voice cloning without the speaker's written consent. Disclose AI narration in the description |
| Human voiceover | Get a work-for-hire agreement |

## Consent and licensing checklist

- [ ] Written consent from any person whose face or voice appears or is cloned
- [ ] Commercial license for the avatar, voice and music (keep receipts and license IDs)
- [ ] Only fictional sample data on screen; no real addresses, names or emails
- [ ] AI mode stated accurately in the narration and visible on screen
- [ ] Disclaimer shown at the end and in the video description
- [ ] No third-party logos or UI (including the reference product's)
- [ ] Captions reviewed for accuracy
- [ ] Final cut reviewed against the app version it depicts (note the commit SHA)
