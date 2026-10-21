# Build report — DealPilot AI

_2026-10-21. Environment: Node 22.22, pnpm 10.28, PostgreSQL 16 (local), headless Chromium._

## Verification results

| Check | Command | Result |
|---|---|---|
| Workspace typecheck (all packages, including the existing app) | `pnpm run typecheck` | ✅ pass |
| Core unit tests (formulas, amortization, financing, CSV, evidence, due diligence, demo analyst, offers) | `pnpm --filter @workspace/dealpilot-core run test` | ✅ 55/55 |
| API integration tests against real PostgreSQL (auth, CSRF, IDOR isolation, CRUD, workflow, AI failure + retry, exports, account deletion) | `pnpm --filter @workspace/dealpilot-api run test` | ✅ 30/30 |
| Production builds (Vite SPA + esbuild server bundle) | `pnpm run dealpilot:build` | ✅ pass |
| Browser E2E: desktop critical flow, manual entry, mobile nav / no horizontal scroll | `pnpm run dealpilot:e2e` | ✅ 3/3 |
| Secret scan of the client bundle | `grep` for key and secret names in `dist/public/assets` | ✅ none found |
| Bundled server boot + `/api/health` | `node dist/index.mjs` | ✅ ok |

There is no linter configured in this repository, so no lint step was run.

## Feature status

| Feature | Status |
|---|---|
| Navigation, dashboard, discover, filters, sort, pagination, saved searches | Implemented, tested |
| 10 fictional sample properties, labelled | Implemented, tested (demo data) |
| Manual entry, CSV import (dry run + row errors), edit, archive/restore | Implemented, tested |
| Underwriting engine with formulas, warnings, versions | Implemented, tested |
| Financing: cash / conventional / DSCR / seller / hybrid | Implemented, tested (illustrative only) |
| Workflow: Queued → Running → Needs Input / Needs Review → Completed / Failed, with retry | Implemented, tested |
| AI analyst — demo mode | Implemented, tested (**demo-only, labelled**) |
| AI analyst — live Claude | Implemented, **awaiting credentials**. Not exercised against the live API |
| Due-diligence tasks (generated + manual) | Implemented, tested |
| Offer drafts (versioned, checklist), PDF/DOCX export, printable report | Implemented, tested |
| Accounts (Better Auth), demo workspaces, ownership isolation, export/delete | Implemented, tested |
| Integrations status screen | Implemented |
| Listing / public-records / rent-comps / maps / email providers | **Future work**: needs licensed providers |
| Billing | **Future work**: disabled by design |
| Email verification and password reset | **Blocked** on an email provider |
| Privacy / terms text | **Placeholder**, needs legal review |
| Demo video | **Plan only**, nothing rendered |
| Reference-material comparison | **Blocked**: materials were not provided |

## Known limitations

- Workflow runs happen inside the request. A slow LLM call holds the request for up to about 2 minutes.
- Rate limiting is in-memory, so it is per instance.
- The sample catalog is re-synced (upserted) at every start. Sample copies already in users' workspaces are not changed.
- Generated PDFs use standard PDF fonts, so characters outside Latin-1 are replaced with close equivalents.
- The client JS bundle is about 590 kB (178 kB gzipped). Code splitting is a possible optimization.
