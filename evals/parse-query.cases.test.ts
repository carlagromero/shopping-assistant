import { describe, expect, it } from "vitest";
import { filtersSchema } from "@/lib/filters";
import { cases as rawCases, NOT_MENTIONED, type EvalCase } from "./parse-query.cases";

// Checks the eval set itself, without calling the model.

// Widen to EvalCase so optional fields are visible on every case.
const cases: EvalCase[] = rawCases;

describe("eval set for parseQuery", () => {
  it("has unique ids", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(cases)("$id: expected is valid for filtersSchema", ({ expected }) => {
    const result = filtersSchema.safeParse(expected);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it.each(cases)("$id: has a query and a note", ({ query, note }) => {
    expect(query.trim()).not.toBe("");
    expect(note.trim()).not.toBe("");
  });

  it.each(cases)("$id: acceptable keywords are valid keyword lists", ({ acceptableKeywords }) => {
    for (const keywords of acceptableKeywords ?? []) {
      expect(filtersSchema.shape.keywords.safeParse(keywords).success).toBe(true);
    }
  });

  it.each(cases.filter((c) => c.expected.intent !== "search"))(
    "$id: a non-search intent leaves every other field as not mentioned",
    ({ expected }) => {
      expect(expected).toEqual({ ...NOT_MENTIONED, intent: expected.intent });
    },
  );
});
