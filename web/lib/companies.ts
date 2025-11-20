import { getDb } from "./db";

export type CompanyListItem = {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string | null;
  faviconUrl: string | null;
  contactCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export function listCompanies(
  limit = 100,
  offset = 0,
  query?: string
): CompanyListItem[] {
  const db = getDb();

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    whereClauses.push("(co.name LIKE ? OR co.domain LIKE ?)");
    params.push(q, q);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT
      co.id AS id,
      co.name AS name,
      co.domain AS domain,
      co.website_url AS websiteUrl,
      co.favicon_url AS faviconUrl,
      COUNT(c.id) AS contactCount,
      co.created_at AS createdAt,
      co.updated_at AS updatedAt
    FROM companies co
    LEFT JOIN contacts c ON c.company_id = co.id
    ${whereSql}
    GROUP BY co.id, co.name, co.domain, co.website_url, co.favicon_url, co.created_at, co.updated_at
    ORDER BY co.domain ASC
    LIMIT ? OFFSET ?
  `);

  params.push(limit, offset);

  return stmt.all(...params) as CompanyListItem[];
}

export function countCompanies(query?: string): number {
  const db = getDb();

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    whereClauses.push("(co.name LIKE ? OR co.domain LIKE ?)");
    params.push(q, q);
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM companies co
    ${whereSql}
  `);

  const row = stmt.get(...params) as { count: number };

  return row.count;
}
