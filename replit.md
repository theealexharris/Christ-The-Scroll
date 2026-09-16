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
- Required env: `AUTH_SECRET` — signs session JWTs; the server throws on startup if unset. Use a long random string (e.g. `openssl rand -hex 32`); changing it invalidates every existing session.
- Optional env: `ANTHROPIC_API_KEY` — enables real AI answers on `/ai/explain` and `/ai/ask-passage`; without it, those endpoints fall back to fixed sample copy

## Deploying (e.g. Render)

One web service hosts both the API and the built frontend — `artifacts/api-server/src/app.ts` serves `artifacts/christ-scroll/dist/public` as static files (falling back to `index.html` for client-side routes) behind the same `/api` routes.

- Build Command: `pnpm install --frozen-lockfile && PORT=5000 BASE_PATH=/ pnpm run build` — the frontend's Vite config requires `PORT`/`BASE_PATH` to exist at build time (it validates them even though this build's output doesn't use `PORT`); the value doesn't matter, but `BASE_PATH` must be `/` so asset URLs resolve correctly when served from this service's root. These are build-time only — don't set `PORT` as a persistent env var, since the platform injects its own `PORT` for the running service and the app must bind to that.
- Start Command: `pnpm --filter @workspace/api-server run start`
- Root Directory: leave blank (commands need to run from the repo root to resolve the pnpm workspace)
- Env vars on the service itself: `DATABASE_URL`, `AUTH_SECRET` (required — see above), `ANTHROPIC_API_KEY`
- After the first deploy, seed the production database once (from your machine, pointed at the deployed `DATABASE_URL`): `pnpm --filter db run push && pnpm --filter db run seed`

## Deployment status

Live in production on Render at `christ-the-scroll.onrender.com` as of 2026-09-16. The production database has been schema-pushed and seeded (66 books, 31,100 verses, 20 people, 20 places, 15 events, 1 journey with 8 stops) — accounts, bookmarks, and reading stats are live and working end-to-end.

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
- `lib/db/src/schema` — Drizzle tables: `books.ts` (books + verses), `people.ts`, `places.ts`, `events.ts`, `journeys.ts` (journeys + stops), `users.ts`, `bookmarks.ts`, `progress.ts` (reading progress, chapter reads, journey progress, reading plans)
- `lib/db/src/seed.ts` — seeds the tables above with the app's Scripture/people/places/events content
- `lib/db/src/data/kjv.json` — full King James Version text (66 books, 1,189 chapters, 31,100 verses); see `KJV-SOURCE.md` in the same directory for provenance/license
- `artifacts/api-server/src/data/christ-scroll.ts` — data-access layer the API routes call into; every function here queries Postgres
- `artifacts/api-server/src/data/auth.ts`, `data/bookmarks.ts` — user and bookmark queries
- `artifacts/api-server/src/routes/christ-scroll.ts`, `routes/auth.ts`, `routes/bookmarks.ts` — HTTP routes
- `artifacts/api-server/src/lib/auth.ts` — password hashing, JWT session cookie, `attachUser`/`requireAuth` middleware
- `artifacts/api-server/src/lib/ai.ts` — Anthropic calls for the explain/ask-passage endpoints
- `artifacts/christ-scroll/src/pages` — the app's screens: Bible reader/browser, Explore (people/places/events), Journeys, Timeline, Onboarding, Profile

## Architecture decisions

- Reading progress, chapter-read stats, and journey progress are keyed by an `ownerId`: a signed-in user's id if authenticated, otherwise an anonymous `cts_visitor_id` cookie. Guests keep working progress without an account; signing in just switches which id the same tables key off.
- Auth is a hand-rolled JWT-in-httpOnly-cookie session (`lib/auth.ts`), not a library like Passport or NextAuth — bcrypt (`bcryptjs`, pure JS, no native build step) for password hashing, `jsonwebtoken` for the session token. There's no "remember me" toggle or refresh-token rotation; sessions just last 30 days.
- Bookmarks require a real account (`requireAuth` middleware) even though progress doesn't — matches the product's guest-vs-signed-in split (browse and read as a guest, sign in to save things permanently).
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
- **Progress** — the app remembers the last book/chapter/verse a visitor reached, and (once signed in) real chapters-read/journeys-taken stats.
- **Accounts & bookmarks** — sign up/sign in, and bookmark verses, people, places, events, or journeys into "My Library" on the profile page.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter db run push` (schema) before `pnpm --filter db run seed` (data) against a fresh database.
- The seed script uses `onConflictDoNothing`/`onConflictDoUpdate`, so it's safe to re-run, but it never deletes rows — dropping a row from the seed source data won't remove it from an already-seeded database.
- `DATABASE_URL` must be set before importing `@workspace/db` — both `lib/db/src/index.ts` and `drizzle.config.ts` throw immediately if it's missing.
- `AUTH_SECRET` must be set for the API server to start at all (`lib/auth.ts` throws the first time it's needed, which is on every request via the `attachUser` middleware) — don't forget it in a new environment, or every request will 500.
- If `pnpm --filter db run push`/`run seed` can't reach the database from wherever you're running it (a sandboxed environment, a locked-down network), Render's own **Shell** tab on the web service works: the container already has the repo and dependencies from the build step, is on Render's network, and has `DATABASE_URL` in its environment already, so you can just run `pnpm --filter db run push-force` (or `run seed`) there directly with no extra setup. Shell access is a paid Render tier feature.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
