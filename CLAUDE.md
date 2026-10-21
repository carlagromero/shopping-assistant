# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early scaffold of a shopping assistant ("asistente de compras"). `src/app/page.tsx` is still the create-next-app placeholder; the real work so far is the database schema and notes about the data source. The README is the unmodified create-next-app boilerplate.

## Next.js version warning

`AGENTS.md` states this Next.js (16.4.2, React 19.3) has breaking changes relative to training data. Read the relevant guide in `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`, ...) before writing Next.js code. `next.config.ts` enables `cacheComponents` and `partialPrefetching`, so caching/prefetch behavior follows the Cache Components model, not the legacy fetch-cache one.

## Commands

Package manager is pnpm (`pnpm-workspace.yaml` only sets `allowBuilds`; this is not a monorepo).

- `pnpm dev` / `pnpm build` / `pnpm start` — Next.js (Tailwind v4 is wired through Turbopack rules in `next.config.ts`, not PostCSS)
- `pnpm lint` — ESLint (flat config, `eslint.config.mjs`)
- `pnpm db:push` — push `src/db/schema.ts` to the database (no migration files are generated; `drizzle.config.ts` sets `out: ./drizzle` but `push` is the workflow in use)
- `pnpm db:studio` — Drizzle Studio

There is no test runner configured yet. `tsx` is installed for running standalone scripts (e.g. the ingest script).

## Environment

Copy `.env.example` to `.env.local` and set `DATABASE_URL` (Neon Postgres connection string). Both `src/db/index.ts` (throws at import if missing) and `drizzle.config.ts` (`process.loadEnvFile(".env.local")`) read it from there.

## Architecture

- **Data source**: DummyJSON (`https://dummyjson.com/products?limit=0` returns the whole catalog: 194 products, 24 categories). `docs/data-notes.md` lists the data quirks and the decisions taken about them — read it (including its Decisions section) before touching ingest, filtering, or price/stock logic.
- **Database**: Neon serverless Postgres via `drizzle-orm/neon-http` (`src/db/index.ts` exports a single `db` with the schema attached). Schema in `src/db/schema.ts`: `categories` (slug PK), `products`, `reviews`.
- **Ingest is designed to be idempotent**: `products.id` reuses the DummyJSON id and `reviews` has a unique `(product_id, reviewer_name, date)` constraint, so re-running ingest upserts instead of duplicating.
- **Ingest** is `scripts/ingest.ts` (`pnpm tsx scripts/ingest.ts`, add `--dry-run` to skip the DB). Its parsers throw on unknown policy text on purpose, so API format changes surface.
- **Policy fields are stored twice**: raw text (`shippingInformation`, `returnPolicy`, `warrantyInformation`) plus normalized day columns (`shippingDays`, `returnDays`, `warrantyDays`) meant for filtering. A `null` normalized value means "no finite number" (lifetime warranty).
- **LLM filters**: `src/lib/filters.ts` holds the zod `filtersSchema` the model fills from a user query. "Not mentioned" is `null` (an empty array for `categories`); each `.describe()` is the prompt for that field.
- **Carts**: DummyJSON carts aren't persisted, so the plan is an own `carts` table (not yet in the schema).
- **AI**: `ai` (Vercel AI SDK v7) and `zod` are installed but unused so far. Check `node_modules/ai/docs/` rather than relying on v5/v6 API memory.

## Data conventions to preserve

- `brand` is nullable (missing for ~half the catalog); don't assume it's present.
- `minimumOrderQuantity` is stored but must stay out of price and cart logic.
- Product `rating` is used as given; never recompute it from reviews.
- Stock is never a user-facing filter: queries always apply `stock > 0` (see Decisions in `docs/data-notes.md`). Compute final price (with `discountPercentage`) in a single place.
- Prices span $0.79–$36,999.99, so budget filters need to account for outliers.

Path alias: `@/*` → `./src/*`.
