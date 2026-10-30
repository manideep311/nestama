import { prisma } from "../src/lib/prisma";

/**
 * A baseline for the search evaluation (the store doesn't use it): PostgreSQL full-text search in
 * which any word of the query can match, stemmed, with English stop words dropped, ranked by
 * `ts_rank`. The name weighs most, then brand, category, tags and species, then the description.
 * Documents are built per query, which is fine for 73 products and no index is needed.
 */
export async function fullTextSearch(q: string, limit = 10): Promise<string[]> {
  const words = q.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (words.length === 0) return [];
  const rows = await prisma.$queryRaw<{ slug: string }[]>`
    WITH query AS (SELECT websearch_to_tsquery('english', ${words.join(" or ")}) AS q),
    docs AS (
      SELECT p.slug, p."soldCount",
        setweight(to_tsvector('english', p.name), 'A') ||
        setweight(to_tsvector('english', concat_ws(' ', b.name, c.name, parent.name, array_to_string(p.tags, ' '),
          CASE p."petType" WHEN 'DOG' THEN 'dog puppy' WHEN 'CAT' THEN 'cat kitten' ELSE 'dog cat' END)), 'B') ||
        setweight(to_tsvector('english', p.description), 'C') AS doc
      FROM products p
      JOIN brands b ON b.id = p."brandId"
      JOIN categories c ON c.id = p."categoryId"
      LEFT JOIN categories parent ON parent.id = c."parentId"
      WHERE p."isActive"
    )
    SELECT slug FROM docs, query
    WHERE doc @@ query.q
    ORDER BY ts_rank(doc, query.q) DESC, "soldCount" DESC, slug
    LIMIT ${limit}`;
  return rows.map((r) => r.slug);
}
