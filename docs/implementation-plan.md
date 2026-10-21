# Implementation plan & status

## Phase 0 — Audit
- The repo already contained a working, unrelated app (*Christ: The Scroll*: pnpm workspace, Express 5, React 19/Vite, Drizzle/Postgres, Anthropic SDK). To preserve it, DealPilot was built as **new packages in the same workspace**, reusing the same stack. Nothing in the existing app was changed. The only shared edits are additive: root `tsconfig.json` references, root `package.json` `dealpilot:*` scripts, and the lockfile.
- Reference materials were not available (see `reference-analysis.md`).
- **Stack choices:** Drizzle, because the repo already uses it and it produces real SQL migrations. Better Auth, a reputable library that owns password hashing and supports isolated anonymous demo accounts, instead of the existing app's hand-rolled auth. pdf-lib and docx, because they're pure JS and bundle cleanly.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 Product shell | Sidebar + mobile drawer, dashboard, discover (categories, search, filters, sort, pagination, empty/loading/error states), property cards/details, 10 labelled samples | **Implemented & E2E-tested** |
| 2 Data & accounts | Postgres schema + migration, property/deal CRUD, archive/restore, CSV import, saved searches, Better Auth, ownership checks, export/delete | **Implemented & integration-tested** |
| 3 Underwriting & financing | Engine, amortization, 5 scenario types, live editing, formulas, warnings, versioned snapshots | **Implemented & unit-tested** |
| 4 AI workflows | Provider adapter, structured prompts, basis labels, demo fallback, persisted workflow with retry/approve | **Implemented & tested. Demo mode verified; live Claude awaits a key** |
| 5 Offers & documents | Versioned draft offers, review checklist, PDF/DOCX export, printable report | **Implemented & tested** |
| 6 Integrations & security | Status screen, env config, rate limits, CSP, CSRF origin check, privacy/terms placeholders | **Implemented**. Legal text is a placeholder |
| 7 QA & deployment | Unit + integration + E2E tests, typecheck, builds, Render blueprint, docs | **Done** (see `build-report.md`) |
| 8 Demo video plan | Script, shots, consent checklist | **Plan written. No video rendered** |

## Next steps (in priority order)
1. Set `ANTHROPIC_API_KEY` and run one live review to verify the adapter end to end.
2. Choose and license a property/rent data provider, then implement its adapter (`docs/integrations.md`).
3. Add an email provider for verification and password reset.
4. Get legal review of the privacy notice, terms and disclaimer.
5. Use a shared rate-limit store (Redis) before running more than one instance.
6. Optional: billing via Stripe Checkout after pricing is approved.
