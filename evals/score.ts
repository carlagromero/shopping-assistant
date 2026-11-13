import type { Filters } from "@/lib/filters";
import type { EvalCase } from "./parse-query.cases";

// Pure scorer for the parseQuery eval: no model, no database. Rules are in issue #13.

export const FIELDS = [
  "intent",
  "categories",
  "brand",
  "keywords",
  "minPrice",
  "maxPrice",
  "minRating",
  "sortBy",
] as const;

export type FieldName = (typeof FIELDS)[number];

export type FieldScore = {
  field: FieldName;
  pass: boolean;
  expected: Filters[FieldName];
  actual: Filters[FieldName];
};

export type CaseScore = {
  pass: boolean;
  /** Only the fields that are scored for this case (non-`search` cases: just `intent`). */
  fields: FieldScore[];
};

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

const lowerSet = (words: readonly string[] | null) => (words ?? []).map((w) => w.toLowerCase());

const normBrand = (b: string | null) => (b === null ? null : b.trim().toLowerCase());

/** Scores a model output against a case. */
export function scoreCase(c: EvalCase, actual: Filters): CaseScore {
  const { expected } = c;

  const checks: Record<FieldName, boolean> = {
    intent: actual.intent === expected.intent,
    categories: sameSet(actual.categories, expected.categories),
    brand: normBrand(actual.brand) === normBrand(expected.brand),
    keywords: [expected.keywords, ...(c.acceptableKeywords ?? [])].some((accepted) =>
      sameSet(lowerSet(actual.keywords), lowerSet(accepted)),
    ),
    minPrice: actual.minPrice === expected.minPrice,
    maxPrice: actual.maxPrice === expected.maxPrice,
    minRating: actual.minRating === expected.minRating,
    sortBy: actual.sortBy === expected.sortBy,
  };

  const scored = expected.intent === "search" ? FIELDS : (["intent"] as const);
  const fields = scored.map((field) => ({
    field,
    pass: checks[field],
    expected: expected[field],
    actual: actual[field],
  }));

  return { pass: fields.every((f) => f.pass), fields };
}
