import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  like,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { getDb } from "./db";
import { companies, contacts, domains, emails } from "./schema";

export type CompanyListItem = {
  id: string;
  name: string;
  domain: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  contactCount: number;
  industry: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export type CompanySortKey =
  | "name"
  | "domain"
  | "industry"
  | "websiteUrl"
  | "contactCount"
  | "createdAt"
  | "updatedAt";

export type SortOrder = "asc" | "desc";

export const DEFAULT_COMPANY_SORT_KEY: CompanySortKey = "contactCount";
export const DEFAULT_COMPANY_SORT_ORDER: SortOrder = "desc";

export type CompanyOption = {
  id: string;
  name: string;
  domain: string | null;
};

export type CompanyDetail = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  industry: string | null;
  city: string | null;
  employeeRange: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  domains: {
    id: string;
    domain: string;
    disposable: boolean;
    webmail: boolean;
    acceptAll: boolean;
    pattern: string | null;
  }[];
  emails: {
    id: string;
    email: string;
    kind: string | null;
    status: string;
    isPrimary: boolean;
    source: string | null;
    confidence: number | null;
    contactId: string | null;
    contactName: string | null;
    contactPosition: string | null;
    domain: string | null;
    updatedAt: number | null;
  }[];
};

export function listCompanies(
  limit = 100,
  offset = 0,
  query?: string,
  sort?: { key: CompanySortKey; order: SortOrder },
  industries?: string[]
): CompanyListItem[] {
  const db = getDb();

  const filters: SQL<unknown>[] = [];

  const companyDomainsSubquery = db
    .select({
      companyId: domains.companyId,
      domain: sql<string | null>`min(${domains.domain})`.as("domain")
    })
    .from(domains)
    .groupBy(domains.companyId)
    .as("company_domains");

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    filters.push(
      or(
        like(companies.name, q),
        like(companyDomainsSubquery.domain, q)
      )
    );
  }

  if (industries && industries.length > 0) {
    const normalized = industries.map((i) => i.trim()).filter((i) => i.length > 0);
    if (normalized.length > 0) {
      filters.push(inArray(companies.industry, normalized));
    }
  }

  const contactCountExpr = sql<number>`count(distinct ${emails.contactId})`;

  const sortKey = sort?.key ?? DEFAULT_COMPANY_SORT_KEY;
  const sortOrder = sort?.order ?? DEFAULT_COMPANY_SORT_ORDER;

  let queryBuilder = db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companyDomainsSubquery.domain,
      websiteUrl: companies.websiteUrl,
      logoUrl: companies.logoUrl,
      faviconUrl: sql<string | null>`null`,
      industry: companies.industry,
      contactCount: contactCountExpr,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt
    })
    .from(companies)
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .leftJoin(contacts, eq(contacts.companyId, companies.id))
    .leftJoin(
      emails,
      and(eq(emails.contactId, contacts.id), eq(emails.status, "Ok")),
    )
    .groupBy(
      companies.id,
      companies.name,
      companies.websiteUrl,
      companies.logoUrl,
      companies.industry,
      companies.createdAt,
      companies.updatedAt,
      companyDomainsSubquery.domain
    );

  const sortExprMap: Record<CompanySortKey, SQL<unknown>> = {
    name: companies.name,
    domain: companyDomainsSubquery.domain,
    industry: companies.industry,
    websiteUrl: companies.websiteUrl,
    contactCount: contactCountExpr,
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt
  };

  const orderFn = sortOrder === "desc" ? desc : asc;

  queryBuilder = queryBuilder
    .orderBy(orderFn(sortExprMap[sortKey]), asc(companies.id))
    .limit(limit)
    .offset(offset);

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  return queryBuilder.all();
}

export function countCompanies(query?: string, industries?: string[]): number {
  const db = getDb();

  const filters: SQL<unknown>[] = [];

  const companyDomainsSubquery = db
    .select({
      companyId: domains.companyId,
      domain: sql<string | null>`min(${domains.domain})`.as("domain")
    })
    .from(domains)
    .groupBy(domains.companyId)
    .as("company_domains");

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    filters.push(
      or(
        like(companies.name, q),
        like(companyDomainsSubquery.domain, q)
      )
    );
  }

  if (industries && industries.length > 0) {
    const normalized = industries.map((i) => i.trim()).filter((i) => i.length > 0);
    if (normalized.length > 0) {
      filters.push(inArray(companies.industry, normalized));
    }
  }

  let queryBuilder = db
    .select({ count: sql<number>`count(*)` })
    .from(companies)
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id));

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  const row = queryBuilder.get();

  return row?.count ?? 0;
}

export function searchCompanies(
  limit = 20,
  query?: string
): CompanyOption[] {
  const db = getDb();

  const deliverableCompaniesSubquery = db
    .select({
      companyId: contacts.companyId
    })
    .from(contacts)
    .innerJoin(
      emails,
      and(eq(emails.contactId, contacts.id), eq(emails.status, "Ok"))
    )
    .groupBy(contacts.companyId)
    .as("deliverable_companies");

  const companyDomainsSubquery = db
    .select({
      companyId: domains.companyId,
      domain: sql<string | null>`min(${domains.domain})`.as("domain")
    })
    .from(domains)
    .groupBy(domains.companyId)
    .as("company_domains");

  const filters: SQL<unknown>[] = [];

  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    filters.push(
      or(like(companies.name, q), like(companyDomainsSubquery.domain, q))
    );
  }

  let queryBuilder = db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companyDomainsSubquery.domain
    })
    .from(companies)
    .innerJoin(deliverableCompaniesSubquery, eq(deliverableCompaniesSubquery.companyId, companies.id))
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id));

  if (filters.length > 0) {
    queryBuilder = queryBuilder.where(and(...filters));
  }

  return queryBuilder.orderBy(asc(companies.name)).limit(limit).all();
}

export function getCompanyOption(companyId: string): CompanyOption | null {
  const db = getDb();

  const companyDomainsSubquery = db
    .select({
      companyId: domains.companyId,
      domain: sql<string | null>`min(${domains.domain})`.as("domain")
    })
    .from(domains)
    .groupBy(domains.companyId)
    .as("company_domains");

  return db
    .select({
      id: companies.id,
      name: companies.name,
      domain: companyDomainsSubquery.domain
    })
    .from(companies)
    .leftJoin(companyDomainsSubquery, eq(companyDomainsSubquery.companyId, companies.id))
    .where(eq(companies.id, companyId))
    .get();
}

export function listIndustries(limit = 200): string[] {
  const db = getDb();

  const rows = db
    .select({
      industry: companies.industry
    })
    .from(companies)
    .where(
      and(
        isNotNull(companies.industry),
        sql`length(trim(${companies.industry})) > 0`
      )
    )
    .groupBy(companies.industry)
    .orderBy(asc(companies.industry))
    .limit(limit)
    .all();

  return rows.map((r) => r.industry as string).filter(Boolean);
}

export function getCompanyDetail(companyId: string): CompanyDetail | null {
  const db = getDb();

  const company = db
    .select({
      id: companies.id,
      name: companies.name,
    description: companies.description,
    websiteUrl: companies.websiteUrl,
    logoUrl: companies.logoUrl,
    industry: companies.industry,
    city: companies.city,
    employeeRange: companies.employeeRange,
    createdAt: companies.createdAt,
    updatedAt: companies.updatedAt,
  })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();

  if (!company) return null;

  const domainRows = db
    .select({
      id: domains.id,
      domain: domains.domain,
      disposable: domains.disposable,
      webmail: domains.webmail,
      acceptAll: domains.acceptAll,
      pattern: domains.pattern,
    })
    .from(domains)
    .where(eq(domains.companyId, companyId))
    .orderBy(asc(domains.domain))
    .all()
    .map((d) => ({
      ...d,
      disposable: Boolean(d.disposable),
      webmail: Boolean(d.webmail),
      acceptAll: Boolean(d.acceptAll),
    }));

  const emailRows = db
    .select({
      id: emails.id,
      email: emails.email,
      kind: emails.kind,
      status: emails.status,
      isPrimary: emails.isPrimary,
      source: emails.source,
      confidence: emails.confidence,
      contactId: contacts.id,
      contactName: contacts.fullName,
      contactPosition: contacts.position,
      domain: domains.domain,
      updatedAt: emails.updatedAt,
    })
    .from(emails)
    .leftJoin(contacts, eq(emails.contactId, contacts.id))
    .leftJoin(domains, eq(emails.domainId, domains.id))
    .where(
      and(
        eq(emails.status, "Ok"),
        or(eq(contacts.companyId, companyId), eq(domains.companyId, companyId)),
      ),
    )
    .orderBy(desc(emails.updatedAt))
    .all()
    .map((e) => ({
      ...e,
      isPrimary: Boolean(e.isPrimary),
    }));

  return {
    ...company,
    domains: domainRows,
    emails: emailRows,
  };
}
