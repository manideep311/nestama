/** Query key for the signed-in shopper's own review of a product. */
export const myReviewKey = (slug: string) => ["account", "my-review", slug] as const;
