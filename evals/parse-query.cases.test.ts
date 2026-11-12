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

  // Keyword rules from issue #10: at most 3 words, each lowercase with no whitespace.
  // Singular and English cannot be checked here; they are reviewed by hand.
  it.each(cases)("$id: expected and acceptable keywords follow the keyword rules", (c) => {
    const lists = [c.expected.keywords ?? [], ...(c.acceptableKeywords ?? [])];
    for (const keywords of lists) {
      expect(keywords.length).toBeLessThanOrEqual(3);
      for (const word of keywords) {
        expect(word).toMatch(/^\S+$/);
        expect(word).toBe(word.toLowerCase());
      }
    }
  });

  it.each(cases.filter((c) => c.expected.intent !== "search"))(
    "$id: a non-search intent leaves every other field as not mentioned",
    ({ expected }) => {
      expect(expected).toEqual({ ...NOT_MENTIONED, intent: expected.intent });
    },
  );
});
