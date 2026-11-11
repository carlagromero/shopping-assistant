import { and, asc, desc, gte, gt, ilike, inArray, lte, ne, or, sql } from "drizzle-orm";
import { products } from "@/db/schema";
import type { Filters } from "./filters";

// Builds the WHERE and ORDER BY for a product search. It never imports `src/db`, so it can be
// unit tested without a database (render the result with PgDialect().sqlToQuery()).

/** Escapes % and _ so user text is matched literally inside ILIKE. */
export function literal(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Turns the filters the model extracted into SQL conditions and an order.
 * Only in-stock products are ever matched (stock > 0 and status is not "Out of Stock"),
 * see docs/data-notes.md. Prices are the list price, before discount.
 */
export function buildSearchQuery(filters: Partial<Filters>) {
  const { categories, brand, keywords, minPrice, maxPrice, minRating, sortBy } = filters;

  const conditions = [gt(products.stock, 0), ne(products.availabilityStatus, "Out of Stock")];

  if (categories?.length) conditions.push(inArray(products.categorySlug, categories));
  if (brand) conditions.push(ilike(products.brand, literal(brand)));
  if (minPrice != null) conditions.push(gte(products.price, minPrice));
  if (maxPrice != null) conditions.push(lte(products.price, maxPrice));
  if (minRating != null) conditions.push(gte(products.rating, minRating));

  // Every keyword must appear somewhere in the title, description or tags.
  for (const keyword of keywords ?? []) {
    const pattern = `%${literal(keyword)}%`;
    conditions.push(
      or(
        ilike(products.title, pattern),
        ilike(products.description, pattern),
        ilike(sql`array_to_string(${products.tags}, ' ')`, pattern),
      )!,
    );
  }

  const orderBy =
    sortBy === "price_asc"
      ? [asc(products.price)]
      : sortBy === "price_desc"
        ? [desc(products.price)]
        : [desc(products.rating)];

  // The id tiebreaker keeps the order stable between runs.
  return { where: and(...conditions), orderBy: [...orderBy, asc(products.id)] };
}
