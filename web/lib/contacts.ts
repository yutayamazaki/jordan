import { getDb } from "./db";

export type ContactListItem = {
  id: string;
  name: string;
  position: string;
  department: string;
  companyName: string;
  companyDomain: string;
  companyWebsiteUrl: string | null;
  companyFaviconUrl: string | null;
  deliverableEmails: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type EmailCandidateListItem = {
  id: string;
  email: string;
  isPrimary: boolean;
  confidence: number;
  type: string;
  pattern: string | null;
  isDeliverable: boolean | null;
  hasMxRecords: boolean | null;
  verificationReason: string | null;
};

export type ContactDetail = {
  contact: {
    id: string;
    name: string;
    position: string;
    department: string;
    departmentCategory: string;
    firstName: string;
    lastName: string;
    companyName: string;
    companyDomain: string;
    companyWebsiteUrl: string | null;
    companyFaviconUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  };
  emailCandidates: EmailCandidateListItem[];
};

export type ContactSortField =
  | "companyName"
  | "companyDomain"
  | "name"
  | "position"
  | "department"
  | "createdAt"
  | "updatedAt";

export type SortDirection = "asc" | "desc";

export type DeliverableEmailsFilter = "all" | "with" | "without";

export function listContacts(
  limit = 100,
  offset = 0,
  sortField: ContactSortField = "companyDomain",
  sortDirection: SortDirection = "asc",
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "all"
): ContactListItem[] {
  const db = getDb();

  let orderByColumn: string;
  switch (sortField) {
    case "companyName":
      orderByColumn = "co.name";
      break;
    case "companyDomain":
      orderByColumn = "co.domain";
      break;
    case "name":
      orderByColumn = "c.name";
      break;
    case "position":
      orderByColumn = "c.position";
      break;
    case "department":
      orderByColumn = "c.department";
      break;
    case "createdAt":
      orderByColumn = "c.created_at";
      break;
    case "updatedAt":
      orderByColumn = "c.updated_at";
      break;
    default:
      orderByColumn = "co.domain";
  }

  const directionSql = sortDirection === "desc" ? "DESC" : "ASC";

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (domainQuery && domainQuery.trim().length > 0) {
    whereClauses.push(
      "(co.domain LIKE ? OR co.name LIKE ? OR c.position LIKE ? OR c.department LIKE ?)"
    );
    const q = `%${domainQuery.trim()}%`;
    params.push(q, q, q, q);
  }

  if (deliverableFilter === "with") {
    whereClauses.push("ec.deliverableEmails IS NOT NULL AND ec.deliverableEmails <> ''");
  } else if (deliverableFilter === "without") {
    whereClauses.push("ec.deliverableEmails IS NULL OR ec.deliverableEmails = ''");
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT
      c.id AS id,
      c.name AS name,
      c.position AS position,
      c.department AS department,
      co.name AS companyName,
      co.domain AS companyDomain,
      co.website_url AS companyWebsiteUrl,
      co.favicon_url AS companyFaviconUrl,
      ec.deliverableEmails AS deliverableEmails,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
    FROM contacts c
    JOIN companies co ON c.company_id = co.id
    LEFT JOIN (
      SELECT
        contact_id,
        group_concat(email, char(10)) AS deliverableEmails
      FROM email_candidates
      WHERE is_deliverable = 1
      GROUP BY contact_id
    ) ec ON ec.contact_id = c.id
    ${whereSql}
    ORDER BY ${orderByColumn} ${directionSql}, co.domain ASC, c.name ASC
    LIMIT ? OFFSET ?
  `);

  params.push(limit, offset);

  return stmt.all(...params) as ContactListItem[];
}

export function listAllContacts(
  sortField: ContactSortField = "companyDomain",
  sortDirection: SortDirection = "asc",
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "all"
): ContactListItem[] {
  const db = getDb();

  let orderByColumn: string;
  switch (sortField) {
    case "companyName":
      orderByColumn = "co.name";
      break;
    case "companyDomain":
      orderByColumn = "co.domain";
      break;
    case "name":
      orderByColumn = "c.name";
      break;
    case "position":
      orderByColumn = "c.position";
      break;
    case "department":
      orderByColumn = "c.department";
      break;
    case "createdAt":
      orderByColumn = "c.created_at";
      break;
    case "updatedAt":
      orderByColumn = "c.updated_at";
      break;
    default:
      orderByColumn = "co.domain";
  }

  const directionSql = sortDirection === "desc" ? "DESC" : "ASC";

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (domainQuery && domainQuery.trim().length > 0) {
    whereClauses.push(
      "(co.domain LIKE ? OR co.name LIKE ? OR c.position LIKE ? OR c.department LIKE ?)"
    );
    const q = `%${domainQuery.trim()}%`;
    params.push(q, q, q, q);
  }

  if (deliverableFilter === "with") {
    whereClauses.push("ec.deliverableEmails IS NOT NULL AND ec.deliverableEmails <> ''");
  } else if (deliverableFilter === "without") {
    whereClauses.push("ec.deliverableEmails IS NULL OR ec.deliverableEmails = ''");
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT
      c.id AS id,
      c.name AS name,
      c.position AS position,
      c.department AS department,
      co.name AS companyName,
      co.domain AS companyDomain,
      co.website_url AS companyWebsiteUrl,
      co.favicon_url AS companyFaviconUrl,
      ec.deliverableEmails AS deliverableEmails,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
    FROM contacts c
    JOIN companies co ON c.company_id = co.id
    LEFT JOIN (
      SELECT
        contact_id,
        group_concat(email, char(10)) AS deliverableEmails
      FROM email_candidates
      WHERE is_deliverable = 1
      GROUP BY contact_id
    ) ec ON ec.contact_id = c.id
    ${whereSql}
    ORDER BY ${orderByColumn} ${directionSql}, co.domain ASC, c.name ASC
  `);

  return stmt.all(...params) as ContactListItem[];
}

export function countContacts(
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "all"
): number {
  const db = getDb();

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (domainQuery && domainQuery.trim().length > 0) {
    whereClauses.push(
      "(co.domain LIKE ? OR co.name LIKE ? OR c.position LIKE ? OR c.department LIKE ?)"
    );
    const q = `%${domainQuery.trim()}%`;
    params.push(q, q, q, q);
  }

  if (deliverableFilter === "with") {
    whereClauses.push("ec.deliverableEmails IS NOT NULL AND ec.deliverableEmails <> ''");
  } else if (deliverableFilter === "without") {
    whereClauses.push("ec.deliverableEmails IS NULL OR ec.deliverableEmails = ''");
  }

  const whereSql =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const stmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM contacts c
    JOIN companies co ON c.company_id = co.id
    LEFT JOIN (
      SELECT
        contact_id,
        group_concat(email, char(10)) AS deliverableEmails
      FROM email_candidates
      WHERE is_deliverable = 1
      GROUP BY contact_id
    ) ec ON ec.contact_id = c.id
    ${whereSql}
  `);

  const row = stmt.get(...params) as { count: number };

  return row.count;
}

export function getContactDetail(contactId: string): ContactDetail | null {
  const db = getDb();

  const contactStmt = db.prepare(`
    SELECT
      c.id AS id,
      c.name AS name,
      c.position AS position,
      c.department AS department,
      c.department_category AS departmentCategory,
      c.first_name AS firstName,
      c.last_name AS lastName,
      co.name AS companyName,
      co.domain AS companyDomain,
      co.website_url AS companyWebsiteUrl,
      co.favicon_url AS companyFaviconUrl,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt
    FROM contacts c
    JOIN companies co ON c.company_id = co.id
    WHERE c.id = ?
  `);

  const contactRow = contactStmt.get(contactId) as ContactDetail["contact"] | undefined;

  if (!contactRow) {
    return null;
  }

  const emailStmt = db.prepare(`
    SELECT
      id,
      email,
      is_primary AS isPrimary,
      confidence,
      type,
      pattern,
      is_deliverable AS isDeliverable,
      has_mx_records AS hasMxRecords,
      verification_reason AS verificationReason
    FROM email_candidates
    WHERE contact_id = ?
      AND (is_deliverable IS NULL OR is_deliverable = 1)
    ORDER BY is_primary DESC, confidence DESC
  `);

  const emailCandidates = emailStmt.all(contactId) as EmailCandidateListItem[];

  return {
    contact: contactRow,
    emailCandidates
  };
}
