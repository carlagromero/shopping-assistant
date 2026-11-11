import { describe, expect, it } from "vitest";
import { parseReturnDays, parseShippingDays, parseWarrantyDays } from "./policy-parsers";

// The strings below are every distinct value found in the DummyJSON catalog (see docs/data-notes.md).

describe("parseShippingDays", () => {
  it.each([
    ["Ships overnight", 1],
    ["Ships in 1-2 business days", 2],
    ["Ships in 3-5 business days", 5],
    ["Ships in 1 week", 7],
    ["Ships in 2 weeks", 14],
    ["Ships in 1 month", 30],
  ])("%s -> %i days", (text, days) => {
    expect(parseShippingDays(text)).toBe(days);
  });

  it("uses the slowest case of a range", () => {
    expect(parseShippingDays("Ships in 3-5 business days")).toBe(5);
  });

  it.each(["", "Ships in 5 hours", "Ships tomorrow", "ships overnight", "Ships in 3-5 business days."])(
    "throws on unknown text: %j",
    (text) => {
      expect(() => parseShippingDays(text)).toThrow(/Unknown shipping text/);
    },
  );
});

describe("parseReturnDays", () => {
  it.each([
    ["No return policy", 0],
    ["7 days return policy", 7],
    ["30 days return policy", 30],
    ["60 days return policy", 60],
    ["90 days return policy", 90],
  ])("%s -> %i days", (text, days) => {
    expect(parseReturnDays(text)).toBe(days);
  });

  it.each(["", "Returns accepted", "30 day return policy", "2 weeks return policy"])(
    "throws on unknown text: %j",
    (text) => {
      expect(() => parseReturnDays(text)).toThrow(/Unknown return text/);
    },
  );
});

describe("parseWarrantyDays", () => {
  it.each([
    ["No warranty", 0],
    ["1 week warranty", 7],
    ["1 month warranty", 30],
    ["3 months warranty", 90],
    ["6 months warranty", 180],
    ["1 year warranty", 365],
    ["2 year warranty", 730],
    ["3 year warranty", 1095],
    ["5 year warranty", 1825],
  ])("%s -> %i days", (text, days) => {
    expect(parseWarrantyDays(text)).toBe(days);
  });

  it("returns null for a lifetime warranty, not a number of days", () => {
    expect(parseWarrantyDays("Lifetime warranty")).toBeNull();
  });

  it("keeps 'no warranty' (0) distinct from 'lifetime' (null)", () => {
    expect(parseWarrantyDays("No warranty")).toBe(0);
    expect(parseWarrantyDays("Lifetime warranty")).toBeNull();
  });

  it.each(["", "Lifetime guarantee", "2 decades warranty", "1 year"])(
    "throws on unknown text: %j",
    (text) => {
      expect(() => parseWarrantyDays(text)).toThrow(/Unknown warranty text/);
    },
  );
});
