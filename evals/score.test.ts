import { describe, expect, it } from "vitest";
import type { Filters } from "@/lib/filters";
import { NOT_MENTIONED, type EvalCase } from "./parse-query.cases";
import { scoreCase } from "./score";

const search = (over: Partial<Filters> = {}): Filters => ({
  ...NOT_MENTIONED,
  intent: "search",
  ...over,
});

const makeCase = (expected: Filters, extra: Partial<EvalCase> = {}): EvalCase => ({
  id: "c",
  query: "q",
  note: "n",
  expected,
  ...extra,
});

const failed = (expected: Filters, actual: Filters, extra: Partial<EvalCase> = {}) =>
  scoreCase(makeCase(expected, extra), actual)
    .fields.filter((f) => !f.pass)
    .map((f) => f.field);

describe("scoreCase", () => {
  it("passes an identical output and scores all 7 fields of a search case", () => {
    const e = search({
      categories: ["laptops"],
      brand: "Apple",
      keywords: ["silver"],
      minPrice: 1,
      maxPrice: 2,
      minRating: 4,
      sortBy: "price_asc",
    });
    const s = scoreCase(makeCase(e), e);
    expect(s.pass).toBe(true);
    expect(s.fields.map((f) => f.field)).toEqual([
      "intent",
      "categories",
      "brand",
      "keywords",
      "minPrice",
      "maxPrice",
      "minRating",
      "sortBy",
    ]);
  });

  describe("intent", () => {
    it("must match exactly", () => {
      expect(failed(search(), { ...NOT_MENTIONED, intent: "not_found" })).toEqual(["intent"]);
    });

    it("non-search cases score only intent and ignore every other field", () => {
      const expected: Filters = { ...NOT_MENTIONED, intent: "out_of_scope" };
      const actual: Filters = {
        intent: "out_of_scope",
        categories: ["laptops"],
        brand: "Apple",
        keywords: ["x"],
        minPrice: 1,
        maxPrice: 2,
        minRating: 3,
        sortBy: "price_desc",
      };
      const s = scoreCase(makeCase(expected), actual);
      expect(s.pass).toBe(true);
      expect(s.fields.map((f) => f.field)).toEqual(["intent"]);
    });

    it("a non-search case fails when intent differs", () => {
      const expected: Filters = { ...NOT_MENTIONED, intent: "needs_clarification" };
      expect(failed(expected, search())).toEqual(["intent"]);
    });
  });

  describe("categories", () => {
    it("ignores order", () => {
      const e = search({ categories: ["mens-shoes", "womens-shoes"] });
      expect(failed(e, search({ categories: ["womens-shoes", "mens-shoes"] }))).toEqual([]);
    });

    it("fails on a missing, extra or different category", () => {
      const e = search({ categories: ["mens-shoes", "womens-shoes"] });
      expect(failed(e, search({ categories: ["mens-shoes"] }))).toEqual(["categories"]);
      expect(failed(e, search({ categories: ["mens-shoes", "womens-shoes", "tops"] }))).toEqual([
        "categories",
      ]);
      expect(failed(e, search({ categories: ["mens-shoes", "tops"] }))).toEqual(["categories"]);
    });

    it("an empty array only matches an empty array", () => {
      expect(failed(search(), search({ categories: ["tops"] }))).toEqual(["categories"]);
    });
  });

  describe("brand", () => {
    it("is case-insensitive and trimmed", () => {
      const e = search({ brand: "Apple" });
      expect(failed(e, search({ brand: "  apple " }))).toEqual([]);
      expect(failed(e, search({ brand: "APPLE" }))).toEqual([]);
    });

    it("fails on a different brand", () => {
      expect(failed(search({ brand: "Apple" }), search({ brand: "Samsung" }))).toEqual(["brand"]);
    });

    it("null only matches null", () => {
      expect(failed(search(), search({ brand: "Apple" }))).toEqual(["brand"]);
      expect(failed(search({ brand: "Apple" }), search())).toEqual(["brand"]);
      expect(failed(search(), search())).toEqual([]);
    });
  });

  describe.each(["minPrice", "maxPrice", "minRating"] as const)("%s", (field) => {
    it("must match exactly, with no tolerance", () => {
      expect(failed(search({ [field]: 4 }), search({ [field]: 4 }))).toEqual([]);
      expect(failed(search({ [field]: 4 }), search({ [field]: 4.01 }))).toEqual([field]);
    });

    it("null only matches null", () => {
      expect(failed(search(), search({ [field]: 0 }))).toEqual([field]);
      expect(failed(search({ [field]: 0 }), search())).toEqual([field]);
      expect(failed(search(), search())).toEqual([]);
    });
  });

  describe("sortBy", () => {
    it("must match exactly", () => {
      expect(failed(search({ sortBy: "price_asc" }), search({ sortBy: "price_asc" }))).toEqual([]);
      expect(failed(search({ sortBy: "price_asc" }), search({ sortBy: "price_desc" }))).toEqual([
        "sortBy",
      ]);
      expect(failed(search({ sortBy: "price_asc" }), search())).toEqual(["sortBy"]);
      expect(failed(search(), search({ sortBy: "rating_desc" }))).toEqual(["sortBy"]);
    });
  });

  describe("keywords", () => {
    it("compares as a set after lowercasing", () => {
      const e = search({ keywords: ["red", "leather"] });
      expect(failed(e, search({ keywords: ["Leather", "RED"] }))).toEqual([]);
    });

    it("fails on a missing or extra keyword", () => {
      const e = search({ keywords: ["red", "leather"] });
      expect(failed(e, search({ keywords: ["red"] }))).toEqual(["keywords"]);
      expect(failed(e, search({ keywords: ["red", "leather", "x"] }))).toEqual(["keywords"]);
    });

    it("treats null and [] as the same", () => {
      expect(failed(search({ keywords: null }), search({ keywords: [] }))).toEqual([]);
      expect(failed(search({ keywords: [] }), search({ keywords: null }))).toEqual([]);
      expect(failed(search({ keywords: null }), search({ keywords: ["x"] }))).toEqual(["keywords"]);
    });

    it("passes when the output equals any acceptableKeywords list", () => {
      const e = search({ keywords: ["suede"] });
      const extra = { acceptableKeywords: [["suede", "brown"], []] };
      expect(failed(e, search({ keywords: ["brown", "suede"] }), extra)).toEqual([]);
      expect(failed(e, search({ keywords: null }), extra)).toEqual([]);
      expect(failed(e, search({ keywords: ["leather"] }), extra)).toEqual(["keywords"]);
    });
  });

  it("a case passes only when every scored field passes, and reports expected vs actual", () => {
    const s = scoreCase(
      makeCase(search({ maxPrice: 80, brand: "Apple" })),
      search({ maxPrice: 90, brand: "Apple" }),
    );
    expect(s.pass).toBe(false);
    expect(s.fields.find((f) => f.field === "maxPrice")).toMatchObject({
      pass: false,
      expected: 80,
      actual: 90,
    });
  });
});
