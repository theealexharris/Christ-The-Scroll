# DealPilot AI — architecture

DealPilot lives in the existing pnpm workspace next to *Christ: The Scroll*. It is a set of new packages, and nothing in the existing app depends on them.

```
lib/dealpilot-core     Pure TypeScript domain logic: schemas (Zod), underwriting, amortization,
                       financing, CSV parsing, evidence gaps, due-diligence rules, demo analyst,
                       offer model, brand. Runs in the browser and on the server. No I/O.
lib/dealpilot-db       Drizzle schema (dp_* tables) + SQL migrations in ./drizzle.
artifacts/dealpilot-api  Express 5 server: Better Auth, REST API, workflow engine, LLM adapter,
                       PDF/DOCX rendering. In production it also serves the built web app.
artifacts/dealpilot    React 19 + Vite + Tailwind v4 + TanStack Query + wouter SPA.
```

## Request flow

```
Browser (SPA) ──same-origin fetch, httpOnly session cookie──▶ Express
   │                                                           ├─ helmet (CSP, frame-ancestors none)
   │                                                           ├─ /api/auth/*  → rate limit → origin check → Better Auth
   │                                                           ├─ /api/*       → JSON body (1.5 MB cap) → origin + content-type check
   │                                                           │                 → attach session → router
   │                                                           │                    ├─ requireUser
   │                                                           │                    ├─ router.param("id") ownership check
   │                                                           │                    └─ services/* (Drizzle, parameterized SQL)
   │                                                           └─ static SPA + index.html fallback
   └─ The same dealpilot-core engine runs client-side for live previews; the server recomputes on save.
```

## Data model (PostgreSQL)

All tables are prefixed `dp_`, so DealPilot can share a database with the existing app.

- **Auth:** `dp_user` (with `is_anonymous` for demo workspaces), `dp_session`, `dp_account` (holds the Better Auth password hash), `dp_verification`.
- **`dp_user_preference`** — JSON preferences, one row per user.
- **`dp_property`** — `owner_id` NULL only for the read-only sample catalog (`is_sample = true`). Saving a sample as a deal copies it into the user's ownership.
- **`dp_property_source_record`** — source status, name, URL, `retrieved_at` and notes. The newest record drives the "freshness" display.
- **`dp_deal`** — owner, property, stage and archive state.
- **`dp_deal_assumption`** — versioned, append-only assumption sets.
- **`dp_underwriting_result`** — immutable snapshots: inputs, outputs and engine version.
- **`dp_financing_scenario`** — validated parameters. Results are recomputed on every read.
- **`dp_workflow_run` / `dp_workflow_step`** — status, attempts, per-step output and error.
- **`dp_ai_message`** — reviews, questions and answers, each tagged with `mode` (demo or live), provider and model.
- **`dp_due_diligence_task`** — a unique `(deal_id, generated_key)` key makes regeneration idempotent.
- **`dp_offer_draft`** — append-only versions.
- **`dp_generated_document`** — metadata plus a frozen JSON snapshot. Files are rendered from the snapshot at download time.
- **`dp_activity_event`** and **`dp_saved_search`**.

Every private row reaches `dp_user` through a cascading foreign key, so `DELETE /api/account` removes everything the user owns. Deals are deleted first because deals restrict property deletion.

## Workflow engine

`services/workflow.ts` runs steps in order and persists state before and after each one:

1. validate inputs (→ **Needs Input** if there are blocking warnings)
2. gather sources (records which permitted sources exist; makes no external calls)
3. run calculations (stores an underwriting snapshot)
4. AI explanation (calls the provider adapter; on error → **Failed** with a user-safe message)
5. flag missing evidence
6. create tasks (idempotent)
7. present for review (→ **Needs Review**)
8. save report — runs only after the user approves (→ **Completed**)

Retry resumes at the failed step. A Needs Input run restarts from validation. Only one queued or running run is allowed per deal. Runs execute inside the request, which is fine for the current step costs. Moving to a job queue would only require changing `execute()`.

## AI boundary

- The provider is chosen at startup: `AnthropicAnalyst` if `ANTHROPIC_API_KEY` is set, otherwise `DemoAnalyst`.
- The model receives only `serializeContextForModel()`: validated property facts, assumptions, engine results, scenario results and evidence gaps. It has no tools, no browsing, and no code, SQL or shell access.
- Output is constrained by a JSON schema (structured outputs), then validated again with Zod before it is stored. Anything invalid is rejected.
- Requests use the server-side refusal fallback (`fallbacks: "default"`), adaptive thinking and `effort: medium`.
- Keys exist only in server env vars. The logger redacts `apiKey`, `password`, `token`, cookies and authorization headers.

## Security controls

| Threat | Control |
|---|---|
| Account takeover / weak auth | Better Auth (scrypt hashing, httpOnly cookies, `Secure` on https), 10+ character passwords, Better Auth's rate limit in production, plus an express-rate-limit on `/api/auth` |
| IDOR | Every service function filters by `owner_id`. `router.param("id")` checks deal ownership before body validation. Malformed UUIDs return 404. Integration tests cover cross-user access |
| CSRF | SameSite=Lax cookies, trusted-Origin allowlist on state-changing requests, and `application/json` required for bodies (cross-site forms can't send it) |
| Injection | Drizzle parameterized queries. `ILIKE` input is escaped. No raw string SQL |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict CSP (`script-src 'self'`) |
| Cost abuse | Per-user AI rate limit (`DEALPILOT_AI_RATE_LIMIT` per 10 minutes); import limited to 10/min and 500 rows / 1 MB |
| Secret leakage | No secrets in the client bundle (verified by grep after build); `.env.example` holds placeholders only |
| Privacy | JSON export and full account deletion in Settings |

**Known gaps:** no email verification or password reset (needs an email provider), no audit-log retention policy, no virus scanning on uploads (CSV is parsed as text only), and the rate limiter is in-memory (use a shared store if you run several instances).
