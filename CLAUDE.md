# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

It holds stable conventions and architecture. For what is built today, known gaps, the file map, and where the project is going, read [AGENTS.md](AGENTS.md) ("Current state" and "Target"). Don't duplicate that here.

## Next.js version warning

`AGENTS.md` states this Next.js (16.4.2, React 19.3) has breaking changes relative to training data. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`, ...) before writing Next.js code. `next.config.ts` enables `cacheComponents` and `partialPrefetching`, so caching/prefetch behavior follows the Cache Components model, not the legacy fetch-cache one.

The Vercel AI SDK is v7. Check `node_modules/ai/docs/` rather than relying on v5/v6 API memory.

## Commands

Package manager is pnpm (`pnpm-workspace.yaml` only sets `allowBuilds`; this is not a monorepo). The full list is in `package.json`.

- `pnpm dev` / `pnpm build` / `pnpm start`: Next.js (Tailwind v4 is wired through Turbopack rules in `next.config.ts`, not PostCSS)
- `pnpm lint`: ESLint (flat config, `eslint.config.mjs`)
- `pnpm db:push`: push `src/db/schema.ts` to the database. No migration files are generated; `drizzle.config.ts` sets `out: ./drizzle` but `push` is the workflow in use.
- `pnpm db:studio`: Drizzle Studio
- `pnpm db:ingest`: run `scripts/ingest.ts` with `.env.local` loaded. Add `--dry-run` through `pnpm tsx scripts/ingest.ts --dry-run` to skip the database.
- `pnpm try "<query>"`: run a query end to end (parse, then search)
- `pnpm test` / `pnpm test:watch`: Vitest (`vitest.config.mts`: `node` environment, `vite-tsconfig-paths` so the `@/*` alias works). Pure-logic unit tests only, in `*.test.ts` files next to the code; no jsdom or React Testing Library.

Tests must not import `src/db` or call the LLM, so they run without `.env.local` and cost nothing. Logic that needs either belongs in an eval or an integration check, not here. A module with side effects on import (like `scripts/ingest.ts`, which runs the ingest) can't be tested: keep testable logic in `src/lib/`.

Standalone scripts run with `tsx` and `--env-file=.env.local`.

## Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`: Neon Postgres connection string. `src/db/index.ts` throws at import if it is missing, and `drizzle.config.ts` loads it with `process.loadEnvFile(".env.local")`.
- `ANTHROPIC_API_KEY`: used by the model call in `src/lib/parse-query.ts`.

## Architecture

- **Data source**: DummyJSON (`https://dummyjson.com/products?limit=0` returns the whole catalog). `docs/data-notes.md` lists the data quirks and the decisions taken about them. Read it, including its Decisions section, before touching ingest, filtering, or price/stock logic.
- **Database**: Neon serverless Postgres via `drizzle-orm/neon-http`. `src/db/index.ts` exports a single `db` with the schema attached. Tables are defined in `src/db/schema.ts`.
- **Ingest is idempotent**: `products.id` reuses the DummyJSON id and `reviews` has a unique `(product_id, reviewer_name, date)` constraint, so re-running ingest upserts instead of duplicating. Keep it that way.
- **Ingest parsers throw on unknown policy text on purpose**, so API format changes surface instead of being ignored. They live in `src/lib/policy-parsers.ts` and are covered by `src/lib/policy-parsers.test.ts`, which lists every distinct policy string found in the catalog. If the catalog gains a new string, the ingest fails: add the case to the parser and to the test together.
- **Policy fields are stored twice**: raw text (`shippingInformation`, `returnPolicy`, `warrantyInformation`) plus normalized day columns (`shippingDays`, `returnDays`, `warrantyDays`) meant for filtering. A `null` normalized value means "no finite number" (lifetime warranty).
- **Query flow**: free text → LLM fills the zod `filtersSchema` (`src/lib/filters.ts`) → `searchProducts` turns the filters into SQL. The model never writes SQL and never sees the database. "Not mentioned" is `null` in every filter field, except `categories`, where it is an empty array. Each `.describe()` in the schema is the prompt for that field, so changing one changes model behavior.
- **Categories are a closed list**: the model may only pick slugs from `CATEGORIES`. If a request fits none, the schema has an `intent` for that instead of forcing the closest category.
- **Carts**: DummyJSON carts aren't persisted, so carts will need an own table.

## Data conventions to preserve

- `brand` is nullable (missing for ~half the catalog); don't assume it's present.
- `minimumOrderQuantity` is stored but must stay out of price and cart logic.
- Product `rating` is used as given; never recompute it from reviews.
- Stock is never a user-facing filter: queries always apply `stock > 0` and exclude `availabilityStatus = "Out of Stock"` (see Decisions in `docs/data-notes.md`).
- The final price (with `discountPercentage`) must be computed in a single place. Whether that exists yet is tracked in AGENTS.md.
- Prices span $0.79–$36,999.99, so budget filters need to account for outliers.

Path alias: `@/*` → `./src/*`.
