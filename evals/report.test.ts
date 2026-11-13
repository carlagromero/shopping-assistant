import { describe, expect, it } from "vitest";
import { NOT_MENTIONED, type EvalCase } from "./parse-query.cases";
import { summarize, type Attempt } from "./report";

const search: EvalCase = {
  id: "a",
  query: "q",
  note: "n",
  expected: { ...NOT_MENTIONED, intent: "search" },
};
const gap: EvalCase = { ...search, id: "g", gap: true };
const oos: EvalCase = {
  id: "o",
  query: "q",
  note: "n",
  expected: { ...NOT_MENTIONED, intent: "out_of_scope" },
};

const att = (caseId: string, run: number, pass: boolean, fields: string[] = []): Attempt => ({
  caseId,
  run,
  output: null,
  latencyMs: 1,
  score: {
    pass,
    fields: (fields.length ? fields : ["intent"]).map((f, i) => ({
      field: f as "intent",
      pass: pass || i > 0,
      expected: null as never,
      actual: null as never,
    })),
  },
});

describe("summarize", () => {
  it("keeps the main score and the gap score separate", () => {
    const s = summarize([search, gap], [att("a", 1, true), att("g", 1, false)]);
    expect(s.main).toEqual({ passed: 1, total: 1 });
    expect(s.gap).toEqual({ passed: 0, total: 1 });
  });

  it("aggregates over runs and flags flaky cases", () => {
    const s = summarize(
      [search, oos],
      [att("a", 1, true), att("a", 2, false), att("o", 1, true), att("o", 2, true)],
    );
    expect(s.main).toEqual({ passed: 3, total: 4 });
    expect(s.flaky).toEqual(["a"]);
    expect(s.perCase.find((c) => c.id === "a")?.rate).toEqual({ passed: 1, total: 2 });
    expect(s.perIntent.search).toEqual({ passed: 1, total: 2 });
    expect(s.perIntent.out_of_scope).toEqual({ passed: 2, total: 2 });
  });

  it("counts a thrown call as a failed case and skips it for field accuracy", () => {
    const err: Attempt = { caseId: "a", run: 1, output: null, error: "boom", score: null, latencyMs: 1 };
    const s = summarize([search], [err, att("a", 2, true)]);
    expect(s.main).toEqual({ passed: 1, total: 2 });
    expect(s.errors).toBe(1);
    expect(s.perField.intent).toEqual({ passed: 1, total: 1 });
  });
});
