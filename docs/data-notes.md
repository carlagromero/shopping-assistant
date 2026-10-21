# DummyJSON data notes (Day 1)

Source: `https://dummyjson.com/products?limit=0` (whole catalog in one call; also `/products/categories`).

## Shape
- 194 products, 24 categories, unique ids.
- Fields: id, title, description, category, price, discountPercentage, rating, stock, tags, brand, sku, weight, dimensions, warrantyInformation, shippingInformation, availabilityStatus, reviews[], returnPolicy, minimumOrderQuantity, meta, images, thumbnail.
- Reviews are nested in each product (582 in total).

## Quirks found
| Quirk | Evidence | Decision (to confirm) |
|---|---|---|
| `brand` missing | 92 of 194 products have none | Nullable column; filter by brand only when present |
| Huge price range | $0.79 to $36,999.99 | Budget filters must be careful; consider outliers |
| `minimumOrderQuantity` absurd for consumer goods | 73 products > 10 (mascara: 48, a football: 27, a single fork: 36) | Store it, but exclude it from "price" and cart logic; document in README |
| Product `rating` doesn't match its reviews | e.g. rating 2.56 with reviews 3, 4, 5 | Treat `rating` as given; never recompute silently |
| Reviews are generic | 582 reviews, only 21 distinct comments | Don't embed reviews as a quality signal; low value for semantic search |
| Stock inconsistent with status | 4 products at stock 0; statuses: In Stock / Low Stock / Out of Stock | Derive "in stock" from `stock > 0`, check against `availabilityStatus` |
| Policies are free text, not structured | 6 shipping strings, 5 return strings, 10 warranty strings | Normalize to days/enum in the ingest step |
| Discount tiny or odd | 0.04% to 19.61% | Store the raw value; compute final price in one place |
| Cart endpoints are fake | DummyJSON carts are not persisted | Own carts table (as planned) |

## Decisions
- **Stock is not a user filter.** `filtersSchema` has no `inStockOnly` field: users don't ask for it and out-of-stock products (4 of 194) are useless in a shopping assistant. The product query always applies `stock > 0` (and cross-checks `availabilityStatus`). Revisit only if we want to answer "is X back in stock?".
