import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { buildSearchQuery, literal } from "./search-query";

// Render the conditions to SQL text and params without a database.
const dialect = new PgDialect();

const render = (filters: Parameters<typeof buildSearchQuery>[0]) => {
  const { where, orderBy } = buildSearchQuery(filters);
  return {
    where: dialect.sqlToQuery(where!),
    // Render each ORDER BY term on its own, in order.
    orderBy: orderBy.map((term) => dialect.sqlToQuery(term).sql),
  };
};

describe("literal", () => {
  it("escapes % and _", () => {
    expect(literal("50%_off")).toBe("50\\%\\_off");
  });

  it("escapes a backslash too", () => {
    expect(literal("a\\b")).toBe("a\\\\b");
  });

  it("escapes the backslash before the wildcards, not twice", () => {
    expect(literal("\\%")).toBe("\\\\\\%");
  });

  it("leaves text without special characters unchanged", () => {
    expect(literal("red leather shoes")).toBe("red leather shoes");
  });

  it("returns an empty string for an empty string", () => {
    expect(literal("")).toBe("");
  });
});

describe("buildSearchQuery: stock conditions", () => {
  it("applies the stock conditions even with empty filters", () => {
    const { where } = render({});
    expect(where.sql).toContain('"products"."stock" > $1');
    expect(where.sql).toContain('"products"."availability_status" <> $2');
    expect(where.params).toEqual([0, "Out of Stock"]);
  });

  it("keeps the stock conditions when other filters are set", () => {
    const { where } = render({ categories: ["mens-shoes"], maxPrice: 50, minRating: 4 });
    expect(where.sql).toContain('"products"."stock" > $1');
    expect(where.sql).toContain('"products"."availability_status" <> $2');
  });
});

describe("buildSearchQuery: user text goes in params", () => {
  it("never puts a keyword inside the SQL string", () => {
    const { where } = render({ keywords: ["sneakers"] });
    expect(where.sql).not.toContain("sneakers");
    expect(where.params).toContain("%sneakers%");
  });

  it("never puts the brand inside the SQL string", () => {
    const { where } = render({ brand: "Nike" });
    expect(where.sql).not.toContain("Nike");
    expect(where.params).toContain("Nike");
  });

  it("keeps an injection attempt out of the SQL string", () => {
    const attack = "'; DROP TABLE products; --";
    const { where } = render({ keywords: [attack], brand: attack });
    expect(where.sql).not.toContain("DROP TABLE");
    expect(where.params).toContain(`%${attack}%`);
    expect(where.params).toContain(attack);
  });

  it("passes prices and rating as params", () => {
    const { where } = render({ minPrice: 11, maxPrice: 222, minRating: 3.5 });
    expect(where.sql).not.toMatch(/\b(11|222|3\.5)\b/);
    // `numeric` columns are sent to Postgres as strings.
    expect(where.params).toEqual(expect.arrayContaining(["11", "222", "3.5"]));
  });

  it("escapes wildcards in keywords and brand before they reach params", () => {
    const { where } = render({ keywords: ["50%_off"], brand: "100%" });
    expect(where.params).toContain("%50\\%\\_off%");
    expect(where.params).toContain("100\\%");
  });
});

describe("buildSearchQuery: filters", () => {
  it("adds no extra conditions for null and empty filters", () => {
    const { where } = render({
      categories: [],
      brand: null,
      keywords: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
      sortBy: null,
    });
    expect(where.params).toEqual([0, "Out of Stock"]);
  });

  it("filters by category with IN", () => {
    const { where } = render({ categories: ["mens-shoes", "womens-shoes"] });
    expect(where.sql).toContain('"products"."category_slug" in');
    expect(where.params).toEqual(expect.arrayContaining(["mens-shoes", "womens-shoes"]));
  });

  it("applies a price of 0 (zero is a value, not 'not mentioned')", () => {
    const { where } = render({ minPrice: 0, maxPrice: 0 });
    expect(where.sql).toContain('"products"."price" >=');
    expect(where.sql).toContain('"products"."price" <=');
  });

  it("uses an inclusive range for price and rating", () => {
    const { where } = render({ minPrice: 10, maxPrice: 50, minRating: 4 });
    expect(where.sql).toContain('"products"."price" >=');
    expect(where.sql).toContain('"products"."price" <=');
    expect(where.sql).toContain('"products"."rating" >=');
  });
});

describe("buildSearchQuery: keywords", () => {
  const countOr = (sql: string) => sql.match(/\sor\s/g)?.length ?? 0;

  it("produces one title/description/tags condition per keyword", () => {
    const { where } = render({ keywords: ["red", "leather", "slim"] });
    // 3 keywords, each OR-ing 3 columns: 2 ORs per keyword.
    expect(countOr(where.sql)).toBe(6);
    expect(where.params).toEqual(expect.arrayContaining(["%red%", "%leather%", "%slim%"]));
  });

  it("joins the keyword conditions with AND, so every keyword must match", () => {
    const { where } = render({ keywords: ["red", "leather"] });
    // Each keyword condition is wrapped in parentheses and AND-ed with the rest.
    expect(where.sql).toMatch(/\) and \(/);
    expect(where.params.filter((p) => p === "%red%" || p === "%leather%")).toHaveLength(6);
  });

  it("searches title, description and tags", () => {
    const { where } = render({ keywords: ["red"] });
    expect(where.sql).toContain('"products"."title" ilike');
    expect(where.sql).toContain('"products"."description" ilike');
    expect(where.sql).toContain("array_to_string");
  });

  it("adds no keyword condition for an empty list", () => {
    const { where } = render({ keywords: [] });
    expect(countOr(where.sql)).toBe(0);
    expect(where.params).toEqual([0, "Out of Stock"]);
  });
});

describe("buildSearchQuery: order", () => {
  it("orders by rating descending by default, then by id", () => {
    expect(render({}).orderBy).toEqual(['"products"."rating" desc', '"products"."id" asc']);
  });

  it("orders by rating when sortBy is null", () => {
    expect(render({ sortBy: null }).orderBy).toEqual(['"products"."rating" desc', '"products"."id" asc']);
  });

  it("orders by rating descending for rating_desc", () => {
    expect(render({ sortBy: "rating_desc" }).orderBy).toEqual([
      '"products"."rating" desc',
      '"products"."id" asc',
    ]);
  });

  it("orders by price ascending for price_asc, then by id", () => {
    expect(render({ sortBy: "price_asc" }).orderBy).toEqual(['"products"."price" asc', '"products"."id" asc']);
  });

  it("orders by price descending for price_desc, then by id", () => {
    expect(render({ sortBy: "price_desc" }).orderBy).toEqual(['"products"."price" desc', '"products"."id" asc']);
  });

  it.each([undefined, null, "rating_desc", "price_asc", "price_desc"] as const)(
    "always ends with the id tiebreaker (sortBy: %s)",
    (sortBy) => {
      const { orderBy } = render({ sortBy });
      expect(orderBy.at(-1)).toBe('"products"."id" asc');
    },
  );
});
