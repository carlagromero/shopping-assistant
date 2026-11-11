import { db } from "@/db";
import { products } from "@/db/schema";
import type { Filters } from "./filters";
import { buildSearchQuery } from "./search-query";

const DEFAULT_LIMIT = 24;

/** Finds products matching the filters the model extracted. See `buildSearchQuery` for the rules. */
export async function searchProducts(filters: Partial<Filters>, limit = DEFAULT_LIMIT) {
  const { where, orderBy } = buildSearchQuery(filters);

  return db
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit);
}
