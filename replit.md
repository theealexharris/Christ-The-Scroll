# Christ: The Scroll

An interactive Bible exploration app. Readers move through Scripture alongside the people, places, and events it describes, follow guided "journeys" through Jesus' ministry, track their reading progress, and can ask an AI assistant questions about the passage on screen.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter db run push` — push DB schema changes (dev only)
- `pnpm --filter db run seed` — seed Scripture, people, places, events, and the sample journey into the database (idempotent — safe to re-run)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `ANTHROPIC_API_KEY` — enables real AI answers on `/ai/explain` and `/ai/ask-passage`; without it, those endpoints fall back to fixed sample copy

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, wouter, TanStack Query, Tailwind + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude (`@anthropic-ai/sdk`), model `claude-sonnet-5`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-zod` — generated Zod schemas + TanStack Query hooks (`pnpm --filter @workspace/api-spec run codegen` to regenerate)
- `lib/db/src/schema` — Drizzle tables: `books.ts` (books + verses), `people.ts`, `places.ts`, `events.ts`, `journeys.ts` (journeys + stops), `progress.ts` (per-visitor reading progress)
- `lib/db/src/seed.ts` — seeds the tables above with the app's Scripture/people/places/events content
- `lib/db/src/data/kjv.json` — full King James Version text (66 books, 1,189 chapters, 31,100 verses); see `KJV-SOURCE.md` in the same directory for provenance/license
- `artifacts/api-server/src/data/christ-scroll.ts` — data-access layer the API routes call into; every function here queries Postgres
- `artifacts/api-server/src/routes/christ-scroll.ts` — HTTP routes
- `artifacts/api-server/src/lib/ai.ts` — Anthropic calls for the explain/ask-passage endpoints
- `artifacts/christ-scroll/src/pages` — the app's screens: Bible reader/browser, Explore (people/places/events), Journeys, Timeline, Onboarding, Profile

## Architecture decisions

- Reading progress is keyed by an anonymous `cts_visitor_id` cookie rather than a login system — there's no account/auth flow in the product yet, so progress is per-browser, not per-person.
- `/ai/explain` and `/ai/ask-passage` never fail outright when the AI call fails or `ANTHROPIC_API_KEY` is unset — they fall back to fixed sample copy so the UI always has something to render. Real AI output silently takes over once the key is configured.
- Cross-references shown on Explore pages (e.g. "people connected to this place") aren't backed by real relational data — the seeded content doesn't encode true relationships, so those lists are a representative slice of the corresponding table, matching the original design.
- The full KJV text is seeded from a static JSON file checked into the repo (`lib/db/src/data/kjv.json`) rather than fetched from an external API at seed time, so seeding works offline and isn't dependent on a third-party service staying up.

## Product

- **Bible reader/browser** — browse all 66 books by testament, read the full King James Version verse by verse.
- **Explore** — look up a person, place, or event and see related Scripture, people, places, and timeline entries.
- **Journeys** — a guided, ordered walk through a set of Scripture-linked stops (currently "Walk With Jesus").
- **Timeline** — a chronological view across the events table.
- **Search** — full-text search across verses, people, places, events, and journeys.
- **AI assistant** — explain a passage in plain language, or ask a free-form question about the passage currently open.
- **Progress** — the app remembers the last book/chapter/verse a visitor reached.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter db run push` (schema) before `pnpm --filter db run seed` (data) against a fresh database.
- The seed script uses `onConflictDoNothing`/`onConflictDoUpdate`, so it's safe to re-run, but it never deletes rows — dropping a row from the seed source data won't remove it from an already-seeded database.
- `DATABASE_URL` must be set before importing `@workspace/db` — both `lib/db/src/index.ts` and `drizzle.config.ts` throw immediately if it's missing.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
