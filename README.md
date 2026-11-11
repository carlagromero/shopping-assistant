# Shopping assistant (asistente de compras)

A Next.js project for a shopping assistant that turns a natural-language query (any language) into structured filters with an LLM, then searches a product catalog in Postgres.

**Status: backend pipeline only.** There is no UI yet: `src/app/page.tsx` is still the create-next-app placeholder and there are no API routes. The pipeline is exercised from the command line.

## What exists today

- **Catalog ingest** (`scripts/ingest.ts`): downloads the whole [DummyJSON](https://dummyjson.com) catalog (24 categories, 194 products, 582 reviews) and upserts it into Postgres. Safe to re-run. Shipping, return and warranty text is also normalized to day counts; the parsers throw on text they don't recognize.
- **Database** (`src/db/schema.ts`): Neon Postgres through Drizzle, with tables `categories`, `products` and `reviews`.
- **Query parsing** (`src/lib/parse-query.ts`, `src/lib/filters.ts`): Claude Haiku (`claude-haiku-5-5`, via the Vercel AI SDK) fills a zod schema with `intent`, `categories`, `brand`, `keywords`, `minPrice`, `maxPrice`, `minRating` and `sortBy`.
- **Product search** (`src/lib/search.ts`): applies those filters with SQL. It only returns in-stock products and orders by rating unless `sortBy` says otherwise (default limit 24).
- **CLI to try it end to end** (`scripts/try-query.ts`): parses a query, prints the filters, and prints the matching products.

Data quirks and the decisions taken about them are in [docs/data-notes.md](docs/data-notes.md).

## Setup

Requires pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm db:push                 # create the tables from src/db/schema.ts
pnpm db:ingest               # load the catalog
```

| Variable | Used by |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string (`src/db/index.ts`, `drizzle.config.ts`) |
| `ANTHROPIC_API_KEY` | `src/lib/parse-query.ts` |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server, build, production server |
| `pnpm lint` | ESLint |
| `pnpm test` / `pnpm test:watch` | Vitest: run once / watch mode |
| `pnpm db:push` | Push the schema to the database (no migration files) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:ingest` | Run the ingest (`tsx --env-file=.env.local scripts/ingest.ts`) |
| `pnpm try "<query>"` | Parse a query and search with the result, e.g. `pnpm try "men's shoes under $50, highly rated"` |

To check the ingest without touching the database: `pnpm tsx scripts/ingest.ts --dry-run`.

Vitest is configured for pure-logic unit tests (`environment: node`, no jsdom). 105 tests cover the policy parsers and the filters schema. They need no `.env.local`, no database and no model call.

## Stack

Next.js 16.4.2 (App Router, `cacheComponents` and `partialPrefetching` enabled), React 19.3, Tailwind CSS v4, Drizzle ORM + Neon, Vercel AI SDK v7 with `@ai-sdk/anthropic`, zod 4, Vitest.

## Roadmap

Not built yet:

- A UI and an API route on top of `parseQuery` + `searchProducts`
- Carts (DummyJSON carts are not persisted, so this needs an own table)
- Final price with discount computed in one place (search currently compares the list price)
- Unit tests for the search query building (`buildSearchQuery`)
- Evals for query parsing
- Logging / observability
- Tests
- Deployment

## License

[MIT](LICENSE)
