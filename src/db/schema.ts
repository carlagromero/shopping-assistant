import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
});

export const products = pgTable("products", {
  // Same id as DummyJSON, so re-running the ingest updates rows instead of duplicating them.
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  categorySlug: text("category_slug")
    .notNull()
    .references(() => categories.slug),
  price: numeric("price", { precision: 10, scale: 2, mode: "number" }).notNull(),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2, mode: "number" }).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2, mode: "number" }).notNull(),
  stock: integer("stock").notNull(),
  availabilityStatus: text("availability_status").notNull(),
  // Missing for about half of the catalog.
  brand: text("brand"),
  sku: text("sku"),
  tags: text("tags").array().notNull().default([]),
  minimumOrderQuantity: integer("minimum_order_quantity").notNull().default(1),
  thumbnail: text("thumbnail"),
  images: text("images").array().notNull().default([]),
  // Raw policy text from the API, plus the same data normalized so it can be filtered.
  shippingInformation: text("shipping_information"),
  shippingDays: integer("shipping_days"),
  returnPolicy: text("return_policy"),
  returnDays: integer("return_days"),
  warrantyInformation: text("warranty_information"),
  warrantyMonths: integer("warranty_months"),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    reviewerName: text("reviewer_name").notNull(),
    date: timestamp("date", { withTimezone: true }).notNull(),
  },
  // Lets the ingest upsert reviews without duplicating them.
  (t) => [unique().on(t.productId, t.reviewerName, t.date)],
);
