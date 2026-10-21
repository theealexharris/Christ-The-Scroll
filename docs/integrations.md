# Integrations

The Integrations screen (`/integrations`, backed by `GET /api/integrations/status`) reports each integration's state from the server's configuration:

- **Connected** — configured *and* implemented in this build.
- **Not configured** — no adapter or no credential.
- **Error** — configured but failing (database down, auth secret missing).

| Integration | Status in this build | Credentials | Fallback |
|---|---|---|---|
| PostgreSQL | Implemented | `DATABASE_URL` | None (required) |
| Better Auth | Implemented | `BETTER_AUTH_SECRET`, `DEALPILOT_APP_URL` | Ephemeral secret in development only |
| LLM — Anthropic Claude | Implemented (`artifacts/dealpilot-api/src/llm/provider.ts`) | `ANTHROPIC_API_KEY`, `DEALPILOT_LLM_MODEL` (default `claude-opus-5-5`) | Deterministic demo analyst, labelled |
| Listings / public records / auctions | **Not implemented** | — | Manual entry, CSV import, samples |
| Rent & sales comps | **Not implemented** (`RENTCAST_API_KEY` reserved) | — | User-entered values with evidence levels |
| Geocoding / maps | **Not implemented** (`MAPBOX_TOKEN` reserved) | — | Addresses shown as entered |
| Email | **Not implemented** (`RESEND_API_KEY` reserved) | — | Nothing is emailed |
| Billing — Stripe | **Not implemented, disabled** | — | All features free; no card data stored |

## Anthropic (LLM)

- **Access:** create an API key in the Anthropic Console and set `ANTHROPIC_API_KEY` on the server only.
- **Cost:** the price is per token and depends on the model (see Anthropic's pricing page). A review sends roughly 2–6k input tokens of deal JSON. Cost is capped by `DEALPILOT_AI_RATE_LIMIT` per user per 10 minutes. To cut cost further, set `DEALPILOT_LLM_MODEL` to a cheaper model such as `claude-sonnet-5-5` or `claude-haiku-5-5`.
- **Data:** the deal's property details, assumptions and results are sent to Anthropic. Disclose this in the privacy notice (the placeholder already does).
- **Failure behavior:** typed errors become user-safe messages; the workflow fails at the AI step and can be retried; nothing is fabricated.
- **Status:** tested with a stubbed failing provider and the demo provider. **It has not been run against the live API in this build session**, because no key was available. The "connected" status means "configured", not "verified".

## Adding a property-data provider

Add the adapter in `artifacts/dealpilot-api/src/` and record each imported record with `source_status = 'live_provider'`, the provider name, URL and `retrieved_at` in `dp_property_source_record`. Before integrating, confirm:

1. The license or terms permit storing and displaying the data, and the redistribution rules.
2. Rate limits and quotas. Cache within what the terms allow.
3. Data freshness. Show `retrieved_at` and re-fetch policies.
4. For probate, foreclosure, sheriff-sale and tax-sale data: use official public sources or licensed aggregators. **Never** scrape, bypass CAPTCHAs or log in on someone else's behalf.

## Stripe (future)

Use Stripe Checkout with server-side webhook signature verification (`STRIPE_WEBHOOK_SECRET`), idempotent event handling keyed by event id, and a `dp_billing_event` table. It stays disabled until pricing and credentials are approved.
