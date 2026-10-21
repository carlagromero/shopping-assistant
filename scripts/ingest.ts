import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

const API = "https://dummyjson.com";
const dryRun = process.argv.includes("--dry-run");

type ApiReview = { rating: number; comment: string; date: string; reviewerName: string };
type ApiProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags?: string[];
  brand?: string;
  sku?: string;
  warrantyInformation?: string;
  shippingInformation?: string;
  availabilityStatus: string;
  reviews?: ApiReview[];
  returnPolicy?: string;
  minimumOrderQuantity?: number;
  images?: string[];
  thumbnail?: string;
};
type ApiCategory = { slug: string; name: string };

const DAYS_PER_UNIT: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

function toDays(amount: number, unit: string): number {
  const days = DAYS_PER_UNIT[unit.replace(/s$/, "")];
  if (days === undefined) throw new Error(`Unknown time unit: "${unit}"`);
  return amount * days;
}

// The parsers throw on formats they don't know, so a change in the API is noticed instead of ignored.

/** "Ships overnight" -> 1, "Ships in 3-5 business days" -> 5 (the slowest case), "Ships in 2 weeks" -> 14 */
export function parseShippingDays(text: string): number {
  if (text === "Ships overnight") return 1;
  const m = text.match(/^Ships in (\d+)(?:-(\d+))? (business days|days|weeks?|months?)$/);
  if (!m) throw new Error(`Unknown shipping text: "${text}"`);
  const amount = Number(m[2] ?? m[1]);
  return toDays(amount, m[3].replace("business ", ""));
}

/** "No return policy" -> 0, "30 days return policy" -> 30 */
export function parseReturnDays(text: string): number {
  if (text === "No return policy") return 0;
  const m = text.match(/^(\d+) days return policy$/);
  if (!m) throw new Error(`Unknown return text: "${text}"`);
  return Number(m[1]);
}

/** "No warranty" -> 0, "2 year warranty" -> 730, "Lifetime warranty" -> null */
export function parseWarrantyDays(text: string): number | null {
  if (text === "No warranty") return 0;
  if (text === "Lifetime warranty") return null;
  const m = text.match(/^(\d+) (weeks?|months?|years?) warranty$/);
  if (!m) throw new Error(`Unknown warranty text: "${text}"`);
  return toDays(Number(m[1]), m[2]);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** On conflict, overwrite every column except the primary key with the incoming value. */
function updateAllExcept(table: PgTable, skip: string[]) {
  return Object.fromEntries(
    Object.entries(getTableColumns(table))
      .filter(([key]) => !skip.includes(key))
      .map(([key, col]) => [key, sql.raw(`excluded."${col.name}"`)]),
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  // limit=0 returns the whole catalog in one call (194 products).
  const { products: apiProducts } = await getJson<{ products: ApiProduct[] }>("/products?limit=0");
  const apiCategories = await getJson<ApiCategory[]>("/products/categories");

  const categoryRows = apiCategories.map((c) => ({ slug: c.slug, name: c.name }));
  const productRows = apiProducts.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    categorySlug: p.category,
    price: p.price,
    discountPercentage: p.discountPercentage,
    rating: p.rating,
    stock: p.stock,
    availabilityStatus: p.availabilityStatus,
    brand: p.brand ?? null,
    sku: p.sku ?? null,
    tags: p.tags ?? [],
    minimumOrderQuantity: p.minimumOrderQuantity ?? 1,
    thumbnail: p.thumbnail ?? null,
    images: p.images ?? [],
    shippingInformation: p.shippingInformation ?? null,
    shippingDays: p.shippingInformation ? parseShippingDays(p.shippingInformation) : null,
    returnPolicy: p.returnPolicy ?? null,
    returnDays: p.returnPolicy ? parseReturnDays(p.returnPolicy) : null,
    warrantyInformation: p.warrantyInformation ?? null,
    warrantyDays: p.warrantyInformation ? parseWarrantyDays(p.warrantyInformation) : null,
  }));
  const reviewRows = apiProducts.flatMap((p) =>
    (p.reviews ?? []).map((r) => ({
      productId: p.id,
      rating: r.rating,
      comment: r.comment,
      reviewerName: r.reviewerName,
      date: new Date(r.date),
    })),
  );

  console.log(
    `Fetched ${categoryRows.length} categories, ${productRows.length} products, ${reviewRows.length} reviews.`,
  );
  if (dryRun) {
    console.log("Dry run: nothing written. Sample product:\n", productRows[0]);
    return;
  }

  // Imported here so a dry run works without DATABASE_URL.
  const { db } = await import("../src/db");
  const { categories, products, reviews } = await import("../src/db/schema");

  await db
    .insert(categories)
    .values(categoryRows)
    .onConflictDoUpdate({ target: categories.slug, set: updateAllExcept(categories, ["slug"]) });

  // Chunked so a single statement never gets too large.
  for (const rows of chunk(productRows, 50)) {
    await db
      .insert(products)
      .values(rows)
      .onConflictDoUpdate({ target: products.id, set: updateAllExcept(products, ["id"]) });
  }
  for (const rows of chunk(reviewRows, 200)) {
    await db.insert(reviews).values(rows).onConflictDoNothing();
  }

  console.log("Done. Safe to run again: rows are updated, not duplicated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
