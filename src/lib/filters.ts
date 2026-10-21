import { z } from "zod";

// Real category slugs from the catalog. The model may only pick from this list.
export const CATEGORIES = [
  "beauty", "fragrances", "furniture", "groceries", "home-decoration",
  "kitchen-accessories", "laptops", "mens-shirts", "mens-shoes", "mens-watches",
  "mobile-accessories", "motorcycle", "skin-care", "smartphones",
  "sports-accessories", "sunglasses", "tablets", "tops", "vehicle",
  "womens-bags", "womens-dresses", "womens-jewellery", "womens-shoes", "womens-watches",
] as const;

// Filters the model extracts from a user query. `intent` says what kind of query it is;
// "not mentioned" is null, except `categories`, where it is an empty array.
export const filtersSchema = z.object({
  intent: z
    .enum(["search", "needs_clarification", "not_found", "out_of_scope"])
    .describe(
      "'search': the user wants products and gave at least one usable filter. 'needs_clarification': the user wants to shop but gave nothing to filter on (e.g. 'a gift for my mom'). 'not_found': the user asks for a type of product that none of the categories covers (e.g. 'a bicycle'). 'out_of_scope': the request has nothing to do with buying products (e.g. 'what time is it?').",
    ),
  categories: z
    .array(z.enum(CATEGORIES))
    .describe(
      "Product categories the user is asking for. Include every category that clearly matches: 'shoes' means both 'mens-shoes' and 'womens-shoes'; 'shirts or dresses' means 'mens-shirts' and 'womens-dresses'. Never force the closest one (a bicycle is not 'vehicle' or 'motorcycle'). Use an empty array if the user did not mention a product type or none of the categories fits.",
    ),
  brand: z
    .string()
    .nullable()
    .describe(
      "Brand name the user is asking for. Use null if the user did not mention a brand.",
    ),
  keywords: z
    .array(z.string())
    .nullable()
    .describe(
      "Descriptive words from the user's query that no other field captures, such as color, material or a feature (e.g. ['red'], ['leather'], ['wireless', 'bluetooth']). One lowercase English word per item, in singular form, at most 3. Do not repeat the category, brand, price or rating here. Use null if there are none.",
    ),
  minPrice: z
    .number()
    .nonnegative()
    .nullable()
    .describe(
      "Minimum price the user is asking for, in USD. Use null if the user did not mention a minimum price.",
    ),
  maxPrice: z
    .number()
    .nonnegative()
    .nullable()
    .describe(
      "Maximum price the user is asking for, in USD. Use null if the user did not mention a maximum price.",
    ),
  minRating: z
    .number()
    .min(0)
    .max(5)
    .nullable()
    .describe(
      "Minimum rating the user is asking for, from 0 to 5. Map vague wording to a fixed number: 'highly rated', 'well rated' or 'well reviewed' = 4. If the user states a number (e.g. 'at least 4.5 stars'), use that number. Superlatives like 'best rated', 'top rated' or 'highest rated' are a ranking, not a threshold: leave this null and use sortBy instead. Use null if the user did not mention ratings.",
    ),
  sortBy: z
    .enum(["price_asc", "price_desc", "rating_desc"])
    .nullable()
    .describe(
      "How to order the results. 'cheapest' or 'lowest price' = price_asc. 'most expensive' or 'premium' = price_desc. 'best rated', 'top rated' or 'highest rated' = rating_desc (do not also set minRating). Use null if the user did not ask for an order.",
    ),
});

export type Filters = z.infer<typeof filtersSchema>;
