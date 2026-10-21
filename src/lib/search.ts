import { and, asc, desc, gte, ilike, inArray, lte, ne, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import type { Filters } from "./filters";

const DEFAULT_LIMIT = 24;

/** Escapes % and _ so user text is matched literally inside ILIKE. */
function literal(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Finds products matching the filters the model extracted.
 * Only in-stock products are ever returned (stock > 0 and status is not "Out of Stock"),
 * see docs/data-notes.md. Prices are the list price, before discount.
 */
export async function searchProducts(filters: Partial<Filters>, limit = DEFAULT_LIMIT) {
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

  return db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(...orderBy, asc(products.id))
    .limit(limit);
}
