import type { Filters } from "@/lib/filters";

// Eval set for `parseQuery`: each case is a user message and the filters the model should
// extract. Rules for expected values are in issue #10. In short:
// - Follow the current `.describe()` text in `src/lib/filters.ts`, not what would ideally happen.
// - Non-`search` intents: only `intent` is scored; every other field is "not mentioned".
// - Keywords: lowercase English singular words, at most 3, whatever the query language.
// - If the `.describe()` text does not define the answer, set `gap: true`.
// - Never reuse an example quoted in a `.describe()`.

export type EvalCase = {
  /** Stable, short, descriptive. Never change it once merged. */
  id: string;
  query: string;
  expected: Filters;
  /** Other keyword lists that also count as correct. */
  acceptableKeywords?: string[][];
  /** The `.describe()` rules do not define the right answer for this query. */
  gap?: boolean;
  /** One line: what this case tests. */
  note: string;
};

/** Every field as "not mentioned". Spread it and override only what the query says. */
export const NOT_MENTIONED = {
  categories: [],
  brand: null,
  keywords: null,
  minPrice: null,
  maxPrice: null,
  minRating: null,
  sortBy: null,
} satisfies Omit<Filters, "intent">;

export const cases = [
  // Example of the format. Keep it, change it or replace it.
  {
    id: "example-category-keywords-max-price",
    query: "red leather shoes for men under $80",
    expected: {
      ...NOT_MENTIONED,
      intent: "search",
      categories: ["mens-shoes"],
      keywords: ["red", "leather"],
      maxPrice: 80,
    },
    note: "One category, two keywords and a maximum price in a single query.",
  },
] satisfies EvalCase[];
