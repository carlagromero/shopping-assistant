<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current state

What is true in the repo today. See `CLAUDE.md` for conventions and `docs/data-notes.md` for data decisions.

### Pipeline

`scripts/ingest.ts` (DummyJSON → Postgres, normalizing policy text with `src/lib/policy-parsers.ts`) → `src/lib/parse-query.ts` (query → `Filters` via Claude Haiku) → `src/lib/search.ts` (`Filters` → SQL). `scripts/try-query.ts` runs parse + search from the CLI (`pnpm try "<query>"`). Nothing else calls these functions yet.

### Files

- `src/db/schema.ts`: `categories`, `products`, `reviews`. `src/db/index.ts` exports `db` and throws at import if `DATABASE_URL` is missing.
- `src/lib/filters.ts`: `CATEGORIES` (hardcoded list of 24 slugs), `filtersSchema` (zod), `Filters` type. `filtersSchema` is tested in `src/lib/filters.test.ts` (69 tests: valid input per `intent`, the `null` / `[]` convention, and rejected input).
- `src/lib/policy-parsers.ts`: `parseShippingDays`, `parseReturnDays`, `parseWarrantyDays`. Pure functions with no side effects that turn the policy text into day counts and throw on unknown text. Used by `scripts/ingest.ts`. Tested in `src/lib/policy-parsers.test.ts` (36 tests, one per distinct string in the catalog plus the failure cases).
- `src/lib/parse-query.ts`: `parseQuery(query)` using `generateText` + `Output.object`, model `claude-haiku-5-5` through `@ai-sdk/anthropic` (needs `ANTHROPIC_API_KEY`), `temperature: 0.0`.
- `src/lib/search-query.ts`: `buildSearchQuery(filters)` returns `{ where, orderBy }` and `literal()` (escapes `%` and `_`). It does not import `src/db`, so it can be unit tested by rendering the result with `new PgDialect().sqlToQuery(where)`. Always applies `stock > 0` and `availabilityStatus != "Out of Stock"`. Brand is a case-insensitive exact match. Each keyword must appear in title, description or tags. Default order is rating desc, then id. Tested in `src/lib/search-query.test.ts` (30 tests: stock conditions, user text in `params`, `literal` escaping, keywords joined with AND, order with the id tiebreaker).
- `src/lib/search.ts`: `searchProducts(filters, limit = 24)`. A thin wrapper: runs the `buildSearchQuery` result against the database.
- `src/app/`: create-next-app placeholder (`page.tsx`, `layout.tsx`). No routes, no UI.

### Commands (all exist in `package.json`)

`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm test`, `pnpm test:watch`, `pnpm db:push`, `pnpm db:studio`, `pnpm db:ingest`, `pnpm eval [--case <id>] [--runs <n>]`, `pnpm try "<query>"`. Dry-run the ingest with `pnpm tsx scripts/ingest.ts --dry-run`. `pnpm test` runs Vitest (`vitest run`, config in `vitest.config.mts`, `node` environment, files named `*.test.ts`). It is set up for pure-logic unit tests only: no jsdom or React Testing Library. Today it runs 299 tests: 36 for the policy parsers, 69 for `filtersSchema`, 30 for `buildSearchQuery`/`literal`, 139 validating the eval set, 22 for the eval scorer and 3 for the eval report.

### Known gaps

- **Prompts are inline.** The system prompt is a string constant in `src/lib/parse-query.ts`; the per-field prompts are the `.describe()` calls in `src/lib/filters.ts`. No prompt versioning or separate prompt files.
- **Model is hardcoded** in `parse-query.ts` and wired to the Anthropic provider directly, not through AI Gateway. No fallback.
- **Evals are manual, no logging.** `evals/parse-query.cases.ts` holds the eval set for `parseQuery` (42 cases, 9 of them `gap`: the `.describe()` rules do not define the answer); `evals/parse-query.cases.test.ts` validates the set without calling the model. `pnpm eval` (`evals/run-parse-query.ts`) runs it against the real model and prints the main score (non-`gap`), the gap score, accuracy per field and per intent, and flaky cases with `--runs <n>`; full results go to `evals/results/` (gitignored). The pure parts are `evals/score.ts` (per-case, per-field scoring) and `evals/report.ts` (aggregation), both unit tested. It costs money, so it is not run in CI: run it by hand after a prompt, schema or model change.
- **Tests cover the policy parsers, `filtersSchema` and `buildSearchQuery`/`literal`.** The database call in `searchProducts` is not unit tested (it needs Neon).
- **`CATEGORIES` is duplicated** from the `categories` table by hand; a new category in the API won't reach the model until the list is edited.
- **No final price.** `searchProducts` filters and sorts on the list price. `discountPercentage` is stored but not applied anywhere, although the data conventions call for one single place to compute it.
- **Prices can be extreme** ($0.79–$36,999.99); budget filters have no outlier handling.
- **No error handling** around the model call or the DB in `parseQuery`/`searchProducts`; the CLI only catches and exits.
- **`intent` other than `search`** (`needs_clarification`, `not_found`, `out_of_scope`) is only printed by the CLI; no code produces a user-facing reply for them.
- **No carts table**, no UI, no API routes.

## Target

Where we want to go. None of this exists yet.

- A chat UI and an API route that call `parseQuery` then `searchProducts`, with replies for each non-`search` intent.
- Prompts in their own files, versioned, with an eval set that scores `parseQuery` (filters extracted vs expected) and runs on each prompt or model change.
- Logging of query, extracted filters and result count.
- Own `carts` table and cart logic (without `minimumOrderQuantity`).
- One function that computes the final price with discount, used by search and carts.
- `CATEGORIES` derived from the database instead of hardcoded.
- Deployment (TODO: decide the target; Vercel is the likely candidate but nothing is configured).
