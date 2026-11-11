<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current state

What is true in the repo today. See `CLAUDE.md` for conventions and `docs/data-notes.md` for data decisions.

### Pipeline

`scripts/ingest.ts` (DummyJSON → Postgres) → `src/lib/parse-query.ts` (query → `Filters` via Claude Haiku) → `src/lib/search.ts` (`Filters` → SQL). `scripts/try-query.ts` runs parse + search from the CLI (`pnpm try "<query>"`). Nothing else calls these functions yet.

### Files

- `src/db/schema.ts`: `categories`, `products`, `reviews`. `src/db/index.ts` exports `db` and throws at import if `DATABASE_URL` is missing.
- `src/lib/filters.ts`: `CATEGORIES` (hardcoded list of 24 slugs), `filtersSchema` (zod), `Filters` type.
- `src/lib/parse-query.ts`: `parseQuery(query)` using `generateText` + `Output.object`, model `claude-haiku-5-5` through `@ai-sdk/anthropic` (needs `ANTHROPIC_API_KEY`), `temperature: 0.0`.
- `src/lib/search.ts`: `searchProducts(filters, limit = 24)`. Always applies `stock > 0` and `availabilityStatus != "Out of Stock"`. Brand is a case-insensitive exact match. Each keyword must appear in title, description or tags. Default order is rating desc, then id.
- `src/app/`: create-next-app placeholder (`page.tsx`, `layout.tsx`). No routes, no UI.

### Commands (all exist in `package.json`)

`pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm db:push`, `pnpm db:studio`, `pnpm db:ingest`, `pnpm try "<query>"`. Dry-run the ingest with `pnpm tsx scripts/ingest.ts --dry-run`. There is no test script.

### Known gaps

- **Prompts are inline.** The system prompt is a string constant in `src/lib/parse-query.ts`; the per-field prompts are the `.describe()` calls in `src/lib/filters.ts`. No prompt versioning or separate prompt files.
- **Model is hardcoded** in `parse-query.ts` and wired to the Anthropic provider directly, not through AI Gateway. No fallback.
- **No evals, no tests, no logging.** There is no way to measure parsing quality yet.
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
- Tests and deployment (TODO: decide the target; Vercel is the likely candidate but nothing is configured).
