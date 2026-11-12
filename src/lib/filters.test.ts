import { describe, expect, it } from "vitest";
import { CATEGORIES, filtersSchema } from "./filters";

// "Not mentioned" is null in every field except `categories`, where it is [].
const empty = {
  intent: "search",
  categories: [],
  brand: null,
  keywords: null,
  minPrice: null,
  maxPrice: null,
  minRating: null,
  sortBy: null,
};

const withFields = (fields: Record<string, unknown>) => ({ ...empty, ...fields });

const without = (field: string) =>
  Object.fromEntries(Object.entries(empty).filter(([key]) => key !== field));

describe("filtersSchema: valid input", () => {
  it.each([
    ["search", withFields({ intent: "search", categories: ["mens-shoes"], maxPrice: 50, minRating: 4 })],
    ["needs_clarification", withFields({ intent: "needs_clarification" })],
    ["not_found", withFields({ intent: "not_found" })],
    ["out_of_scope", withFields({ intent: "out_of_scope" })],
  ])("parses a valid %s filter object", (intent, input) => {
    const result = filtersSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.intent).toBe(intent);
  });

  it("parses a filter object with every field filled", () => {
    const input = {
      intent: "search",
      categories: ["mens-shoes", "womens-shoes"],
      brand: "Nike",
      keywords: ["red", "leather"],
      minPrice: 10,
      maxPrice: 50,
      minRating: 4.5,
      sortBy: "price_asc",
    };
    expect(filtersSchema.parse(input)).toEqual(input);
  });

  it.each(CATEGORIES)("accepts the category %s", (category) => {
    expect(filtersSchema.safeParse(withFields({ categories: [category] })).success).toBe(true);
  });

  it.each(["price_asc", "price_desc", "rating_desc"])("accepts sortBy %s", (sortBy) => {
    expect(filtersSchema.safeParse(withFields({ sortBy })).success).toBe(true);
  });

  it("accepts the boundary values 0 and 5 for minRating, and 0 for prices", () => {
    expect(filtersSchema.safeParse(withFields({ minRating: 0 })).success).toBe(true);
    expect(filtersSchema.safeParse(withFields({ minRating: 5 })).success).toBe(true);
    expect(filtersSchema.safeParse(withFields({ minPrice: 0, maxPrice: 0 })).success).toBe(true);
  });
});

describe("filtersSchema: not mentioned", () => {
  it("parses the all-empty object and keeps null / []", () => {
    const parsed = filtersSchema.parse(empty);
    expect(parsed.categories).toEqual([]);
    expect(parsed.brand).toBeNull();
    expect(parsed.keywords).toBeNull();
    expect(parsed.minPrice).toBeNull();
    expect(parsed.maxPrice).toBeNull();
    expect(parsed.minRating).toBeNull();
    expect(parsed.sortBy).toBeNull();
  });

  it("rejects null for categories (its empty value is [])", () => {
    expect(filtersSchema.safeParse(withFields({ categories: null })).success).toBe(false);
  });

  it.each(["brand", "keywords", "minPrice", "maxPrice", "minRating", "sortBy"])(
    "rejects a missing %s (it must be an explicit null)",
    (field) => {
      expect(filtersSchema.safeParse(without(field)).success).toBe(false);
    },
  );

  it("rejects a missing categories (it must be an explicit [])", () => {
    expect(filtersSchema.safeParse(without("categories")).success).toBe(false);
  });
});

describe("filtersSchema: rejected input", () => {
  it.each(["bicycle", "Mens-Shoes", "shoes", ""])("rejects the category %j outside CATEGORIES", (category) => {
    expect(filtersSchema.safeParse(withFields({ categories: [category] })).success).toBe(false);
  });

  it("rejects a list that mixes a valid and an invalid category", () => {
    expect(filtersSchema.safeParse(withFields({ categories: ["laptops", "bicycle"] })).success).toBe(false);
  });

  it.each(["browse", "SEARCH", "", null])("rejects the intent %j", (intent) => {
    expect(filtersSchema.safeParse(withFields({ intent })).success).toBe(false);
  });

  it.each(["cheapest", "rating_asc", ""])("rejects the sortBy %j", (sortBy) => {
    expect(filtersSchema.safeParse(withFields({ sortBy })).success).toBe(false);
  });

  it.each([5.1, 6, 100, -0.1, -1])("rejects minRating %j (outside 0-5)", (minRating) => {
    expect(filtersSchema.safeParse(withFields({ minRating })).success).toBe(false);
  });

  it.each(["minPrice", "maxPrice"])("rejects a negative %s", (field) => {
    expect(filtersSchema.safeParse(withFields({ [field]: -1 })).success).toBe(false);
  });

  it.each([
    ["minPrice", "50"],
    ["maxPrice", "cheap"],
    ["minRating", "4"],
    ["brand", 42],
    ["keywords", "red"],
    ["keywords", [1, 2]],
  ])("rejects %s with the wrong type %j", (field, value) => {
    expect(filtersSchema.safeParse(withFields({ [field]: value })).success).toBe(false);
  });

  it.each([NaN, Infinity])("rejects the non-finite price %j", (price) => {
    expect(filtersSchema.safeParse(withFields({ maxPrice: price })).success).toBe(false);
  });
});
