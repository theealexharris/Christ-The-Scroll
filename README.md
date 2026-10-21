# Christ: The Scroll

An interactive Bible exploration app — read Scripture alongside the people, places, and events it describes, follow guided journeys through Jesus' ministry, and ask an AI assistant questions about the passage you're reading.

See [`replit.md`](./replit.md) for architecture notes, run instructions, and required environment variables.

---

# DealPilot AI (real estate investment workspace)

This repo also contains **DealPilot AI**, an AI-assisted real estate underwriting app. It is fully separate from the Bible app above. It is decision-support software, not a broker, lender, appraiser or attorney.

| Package | Purpose |
|---|---|
| `lib/dealpilot-core` | Underwriting/financing engine, schemas, CSV import, demo analyst (unit-tested) |
| `lib/dealpilot-db` | Drizzle schema + SQL migrations (`dp_*` tables) |
| `artifacts/dealpilot-api` | Express API, Better Auth, workflow engine, Claude adapter, PDF/DOCX export |
| `artifacts/dealpilot` | React web app |

Docs: [architecture](docs/architecture.md) · [formulas](docs/financial-formulas.md) · [integrations](docs/integrations.md) · [plan](docs/implementation-plan.md) · [build report](docs/build-report.md) · [reference analysis](docs/reference-analysis.md) · [demo video plan](docs/demo-video-production.md). Environment variables are listed in [`.env.example`](.env.example).

## Run locally (or in the Replit shell)

```sh
pnpm install
export DATABASE_URL=postgres://…            # any PostgreSQL 14+
export BETTER_AUTH_SECRET=$(openssl rand -hex 32)
pnpm run dealpilot:migrate                   # optional; the API also migrates on start
pnpm run dealpilot:dev:api                   # API on :8090 (builds, then starts)
pnpm run dealpilot:dev:web                   # UI on :5174, proxies /api to :8090
```

Open http://localhost:5174 and click **Try a demo workspace**. Set `ANTHROPIC_API_KEY` to switch the analyst from demo mode to live Claude.

DealPilot is not registered as a Replit artifact, because its `/api` route would collide with the existing app's router. Run it from the shell as above, or give it its own Repl.

## Test

```sh
pnpm run dealpilot:test                       # core unit tests; API integration tests need:
export DEALPILOT_TEST_DATABASE_URL=postgres://…/dealpilot_test   # disposable — the schema is dropped
pnpm run dealpilot:build && PORT=8090 NODE_ENV=production pnpm run dealpilot:start &
pnpm run dealpilot:e2e                        # Playwright against :8090
```

## Deploy (Render)

Use the Blueprint file `render.dealpilot.yaml` (one web service plus Postgres), or set it up by hand:

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm run dealpilot:build`
- Start: `pnpm run dealpilot:start`
- Health check: `/api/health`
- Env: `NODE_ENV=production`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DEALPILOT_APP_URL=https://<your-service>.onrender.com`, optional `ANTHROPIC_API_KEY`

Migrations run at startup and are additive. To roll back, redeploy the previous commit. There are no destructive migrations yet; check `lib/dealpilot-db/drizzle/` before rolling back across a schema change.
