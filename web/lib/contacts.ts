import {
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  like,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { getDb } from "./db";
import { companies, contacts, domains, emails } from "./schema";

export type ContactListItem = {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  companyName: string;
  companyDomain: string | null;
  companyWebsiteUrl: string | null;
  companyLogoUrl: string | null;
  deliverableEmails: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export type EmailCandidateListItem = {
  id: string;
  email: string;
  isPrimary: boolean;
  confidence: number;
  type: string | null;
  pattern: string | null;
  isDeliverable: boolean | null;
  hasMxRecords: boolean | null;
  verificationReason: string | null;
};

export type ContactDetail = {
  contact: {
    id: string;
    name: string;
    position: string | null;
    department: string | null;
    departmentCategory: string | null;
    firstName: string | null;
    lastName: string | null;
    companyName: string;
    companyDomain: string | null;
    companyWebsiteUrl: string | null;
    companyLogoUrl: string | null;
    createdAt: number | null;
    updatedAt: number | null;
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

export type DeliverableEmailsFilter = "with" | "without";

type DbClient = ReturnType<typeof getDb>;

function buildCompanyDomainsSubquery(db: DbClient) {
  return db
    .select({
      companyId: domains.companyId,
      domain: sql<string | null>`min(${domains.domain})`.as("domain")
    })
    .from(domains)
    .groupBy(domains.companyId)
    .as("company_domains");
}

function buildDeliverableEmailsSubquery(db: DbClient) {
  return db
    .select({
      contactId: emails.contactId,
      deliverableEmails: sql<string | null>`group_concat(${emails.email}, char(10))`.as(
        "deliverableEmails"
      )
    })
    .from(emails)
    .where(eq(emails.status, "verified_ok"))
    .groupBy(emails.contactId)
    .as("deliverable_emails");
}

function buildContactFilters(
  domainQuery: string | undefined,
  deliverableFilter: DeliverableEmailsFilter,
  deliverableEmailsSubquery: ReturnType<typeof buildDeliverableEmailsSubquery>,
  companyDomainsSubquery: ReturnType<typeof buildCompanyDomainsSubquery>
): SQL<unknown>[] {
  const filters: SQL<unknown>[] = [];

  if (domainQuery && domainQuery.trim().length > 0) {
    const q = `%${domainQuery.trim()}%`;
    filters.push(
      or(
        like(companyDomainsSubquery.domain, q),
        like(companies.name, q),
        like(contacts.position, q),
        like(contacts.department, q)
      )
    );
  }

  if (deliverableFilter === "with") {
    filters.push(isNotNull(deliverableEmailsSubquery.deliverableEmails));
  } else if (deliverableFilter === "without") {
    filters.push(isNull(deliverableEmailsSubquery.deliverableEmails));
  }

  return filters;
}

function resolveSortColumn(
  sortField: ContactSortField,
  companyDomainsSubquery: ReturnType<typeof buildCompanyDomainsSubquery>
) {
  switch (sortField) {
    case "companyName":
      return companies.name;
    case "companyDomain":
      return companyDomainsSubquery.domain;
    case "name":
      return contacts.fullName;
    case "position":
      return contacts.position;
    case "department":
      return contacts.department;
    case "createdAt":
      return contacts.createdAt;
    case "updatedAt":
      return contacts.updatedAt;
    default:
      return companyDomainsSubquery.domain;
  }
}

export function listContacts(
  limit = 100,
  offset = 0,
  sortField: ContactSortField = "companyDomain",
  sortDirection: SortDirection = "asc",
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "with"
): ContactListItem[] {
  const db = getDb();
  const companyDomainsSubquery = buildCompanyDomainsSubquery(db);
  const deliverableEmailsSubquery = buildDeliverableEmailsSubquery(db);
  const filters = buildContactFilters(
    domainQuery,
    deliverableFilter,
    deliverableEmailsSubquery,
    companyDomainsSubquery
  );

  const orderByColumn = resolveSortColumn(sortField, companyDomainsSubquery);
  const orderByExpression =
    sortDirection === "desc" ? desc(orderByColumn) : asc(orderByColumn);

  let queryBuilder = db
    .select({
      id: contacts.id,
      name: contacts.fullName,
      position: contacts.position,
      department: contacts.department,
      companyName: companies.name,
      companyDomain: companyDomainsSubquery.domain,
      companyWebsiteUrl: companies.websiteUrl,
      companyLogoUrl: companies.logoUrl,
      deliverableEmails: deliverableEmailsSubquery.deliverableEmails,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .leftJoin(deliverableEmailsSubquery, eq(deliverableEmailsSubquery.contactId, contacts.id));

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  queryBuilder = queryBuilder.orderBy(
    orderByExpression,
    asc(companyDomainsSubquery.domain),
    asc(contacts.fullName)
  );

  return queryBuilder.limit(limit).offset(offset).all();
}

export function listAllContacts(
  sortField: ContactSortField = "companyDomain",
  sortDirection: SortDirection = "asc",
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "with"
): ContactListItem[] {
  const db = getDb();
  const companyDomainsSubquery = buildCompanyDomainsSubquery(db);
  const deliverableEmailsSubquery = buildDeliverableEmailsSubquery(db);
  const filters = buildContactFilters(
    domainQuery,
    deliverableFilter,
    deliverableEmailsSubquery,
    companyDomainsSubquery
  );

  const orderByColumn = resolveSortColumn(sortField, companyDomainsSubquery);
  const orderByExpression =
    sortDirection === "desc" ? desc(orderByColumn) : asc(orderByColumn);

  let queryBuilder = db
    .select({
      id: contacts.id,
      name: contacts.fullName,
      position: contacts.position,
      department: contacts.department,
      companyName: companies.name,
      companyDomain: companyDomainsSubquery.domain,
      companyWebsiteUrl: companies.websiteUrl,
      companyLogoUrl: companies.logoUrl,
      deliverableEmails: deliverableEmailsSubquery.deliverableEmails,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .leftJoin(deliverableEmailsSubquery, eq(deliverableEmailsSubquery.contactId, contacts.id));

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  queryBuilder = queryBuilder.orderBy(
    orderByExpression,
    asc(companyDomainsSubquery.domain),
    asc(contacts.fullName)
  );

  return queryBuilder.all();
}

export function countContacts(
  domainQuery?: string,
  deliverableFilter: DeliverableEmailsFilter = "with"
): number {
  const db = getDb();
  const companyDomainsSubquery = buildCompanyDomainsSubquery(db);
  const deliverableEmailsSubquery = buildDeliverableEmailsSubquery(db);
  const filters = buildContactFilters(
    domainQuery,
    deliverableFilter,
    deliverableEmailsSubquery,
    companyDomainsSubquery
  );

  let queryBuilder = db
    .select({ count: sql<number>`count(*)` })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .leftJoin(deliverableEmailsSubquery, eq(deliverableEmailsSubquery.contactId, contacts.id));

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  const row = queryBuilder.get();

  return row?.count ?? 0;
}

export function getContactDetail(contactId: string): ContactDetail | null {
  const db = getDb();
  const companyDomainsSubquery = buildCompanyDomainsSubquery(db);

  const contactIdNumber = Number(contactId);
  if (!Number.isFinite(contactIdNumber)) {
    return null;
  }

  const contactRow = db
    .select({
      id: contacts.id,
      name: contacts.fullName,
      position: contacts.position,
      department: contacts.department,
      departmentCategory: contacts.seniority,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      companyName: companies.name,
      companyDomain: companyDomainsSubquery.domain,
      companyWebsiteUrl: companies.websiteUrl,
      companyLogoUrl: companies.logoUrl,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .where(eq(contacts.id, contactIdNumber))
    .get();

  if (!contactRow) {
    return null;
  }

  const emailCandidatesResult = db
    .select({
      id: emails.id,
      email: emails.email,
      isPrimary: emails.isPrimary,
      confidence: emails.confidence ?? sql<number>`0`,
      type: emails.kind ?? sql<string>`''`,
      pattern: sql<string | null>`null`,
      isDeliverable: sql<boolean | null>`case when ${emails.status} = 'verified_ok' then 1 when ${emails.status} = 'verified_ng' then 0 else null end`,
      hasMxRecords: sql<boolean | null>`null`,
      verificationReason: emails.status
    })
    .from(emails)
    .where(
      and(
        eq(emails.contactId, contactIdNumber),
        eq(emails.status, "verified_ok")
      )
    )
    .orderBy(desc(emails.isPrimary), desc(emails.confidence))
    .all();

  return {
    contact: contactRow,
    emailCandidates: emailCandidatesResult
  };
}
