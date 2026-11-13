import type { Filters } from "@/lib/filters";
import type { EvalCase } from "./parse-query.cases";
import { FIELDS, type CaseScore, type FieldName } from "./score";

// Pure aggregation of eval attempts into the numbers the report prints. No model, no I/O.

export type Attempt = {
  caseId: string;
  /** 1-based run number. */
  run: number;
  output: Filters | null;
  /** Set when the model call threw or timed out; the attempt then counts as failed. */
  error?: string;
  score: CaseScore | null;
  latencyMs: number;
};

export type Rate = { passed: number; total: number };

export type Summary = {
  main: Rate;
  gap: Rate;
  /** Accuracy per field, over attempts where the field is scored and the model answered. */
  perField: Partial<Record<FieldName, Rate>>;
  /** Pass rate per expected intent (all cases, gap included). */
  perIntent: Record<string, Rate>;
  perCase: { id: string; gap: boolean; rate: Rate }[];
  /** Cases that passed in some runs and failed in others. */
  flaky: string[];
  errors: number;
};

// Returns a new Rate with one more attempt counted (and one more pass if `pass`); starts from zero if `r` is undefined.
const add = (r: Rate | undefined, pass: boolean): Rate => ({
  passed: (r?.passed ?? 0) + (pass ? 1 : 0),
  total: (r?.total ?? 0) + 1,
});

// Formats a Rate as a percentage with one decimal ("n/a" when there is nothing to count).
export const pct = (r: Rate) => (r.total === 0 ? "n/a" : `${((100 * r.passed) / r.total).toFixed(1)}%`);

// Aggregates every attempt into the report numbers: score, accuracy per field/intent/case, flaky cases and errors.
export function summarize(cases: readonly EvalCase[], attempts: readonly Attempt[]): Summary {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const s: Summary = {
    main: { passed: 0, total: 0 },
    gap: { passed: 0, total: 0 },
    perField: {},
    perIntent: {},
    perCase: [],
    flaky: [],
    errors: 0,
  };
  const perCase = new Map<string, Rate>();

  for (const a of attempts) {
    const c = byId.get(a.caseId);
    if (!c) continue;
    const pass = a.score?.pass ?? false;
    if (a.error !== undefined) s.errors++;

    if (c.gap) s.gap = add(s.gap, pass);
    else s.main = add(s.main, pass);
    s.perIntent[c.expected.intent] = add(s.perIntent[c.expected.intent], pass);
    perCase.set(c.id, add(perCase.get(c.id), pass));

    for (const f of a.score?.fields ?? []) s.perField[f.field] = add(s.perField[f.field], f.pass);
  }

  for (const c of cases) {
    const rate = perCase.get(c.id);
    if (!rate) continue;
    s.perCase.push({ id: c.id, gap: c.gap === true, rate });
    if (rate.passed > 0 && rate.passed < rate.total) s.flaky.push(c.id);
  }
  return s;
}

// Field names in report order, limited to those that were scored at least once.
export const scoredFields = (s: Summary) => FIELDS.filter((f) => s.perField[f]);
