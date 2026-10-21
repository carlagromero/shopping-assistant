import { parseQuery } from "../src/lib/parse-query";
import { searchProducts } from "../src/lib/search";

// Usage: pnpm try "men's shoes under $50, highly rated"
async function main() {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error('Usage: pnpm try "your query"');
    process.exit(1);
  }

  const filters = await parseQuery(query);
  console.log("\nFilters:\n", JSON.stringify(filters, null, 2));

  if (filters.intent !== "search") {
    console.log(`\nIntent is "${filters.intent}", so no product search.`);
    return;
  }

  const results = await searchProducts(filters);
  console.log(`\n${results.length} products:`);
  for (const p of results) {
    console.log(`  #${p.id} ${p.title} | $${p.price} | rating ${p.rating} | ${p.brand ?? "no brand"} | ${p.categorySlug}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
