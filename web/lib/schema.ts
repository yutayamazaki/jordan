// db/schema.ts
import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    websiteUrl: text("website_url"), // 代表サイト
    logoUrl: text("logo_url"), // 会社サイトのロゴ画像URL
    description: text("description"),
    industry: text("industry"),
    city: text("city"),
    employeeRange: text("employee_range"), // "1-10", "11-50" etc.
    primaryDomainId: integer("primary_domain_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    nameIdx: index("idx_companies_name").on(table.name),
  }),
);

export const domains = sqliteTable("domains", {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(), // example.com
    disposable: integer("disposable", { mode: "boolean" })
      .notNull()
      .default(false), // 使い捨てアドレスなら true
    webmail: integer("webmail", { mode: "boolean" })
      .notNull()
      .default(false), // Gmail, Yahoo 等のWebメールなら true
    acceptAll: integer("accept_all", { mode: "boolean" })
      .notNull()
      .default(false), // 受信許可なら true
    pattern: text("pattern"), // "{first}.{last}@{domain}" 等
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    domainUnique: uniqueIndex("idx_domains_domain").on(table.domain),
    companyIdx: index("idx_domains_company_id").on(table.companyId),
  }),
);

export const contacts = sqliteTable("contacts", {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    position: text("position"), // 役職
    positionCategory: text("position_category"), // 役職カテゴリ（正規化済み）
    department: text("department"), // 部署
    departmentCategory: text("department_category"), // 部署カテゴリ（正規化済み）
    seniority: text("seniority"), // "C-level", "Manager" 等
    city: text("city"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    phoneNumber: text("phone_number"),
    sourceLabel: text("source_label"), // 取得元のラベル
    sourceUrl: text("source_url"), // その人を見つけたURL
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    companyIdx: index("idx_contacts_company_id").on(table.companyId),
    posDeptIdx: index("idx_contacts_position_department").on(
      table.position,
      table.department,
    ),
    createdAtIdx: index("idx_contacts_created_at").on(table.createdAt),
  }),
);

export const emails = sqliteTable("emails", {
    id: text("id").primaryKey(),
    contactId: text("contact_id")
      .references(() => contacts.id, { onDelete: "set null" }), // genericメールもありえるので nullable
    domainId: text("domain_id")
      .references(() => domains.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    // "personal": 個人メール
    // "generic": info@, contact@, sales@ 等の汎用メール
    // "role": CTO@, CEO@ 等の役職メール
    kind: text("kind"),
    source: text("source"), // "pattern_guess" | "on_page" | "https://company.com/recruite" 等
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status")
      .notNull()
      .default("pending"),
    // "pending", "verified_ok", "verified_ng", "risky", "error", "skipped" 等
    confidence: real("confidence"), // 0〜1 or 0〜100（どちらかに統一）
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("idx_emails_email").on(table.email),
    contactIdx: index("idx_emails_contact_id").on(table.contactId),
    statusIdx: index("idx_emails_status").on(table.status),
  }),
);

export const emailVerifications = sqliteTable( "email_verifications", {
    id: text("id").primaryKey(),
    emailId: text("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "emailhippo" 等
    resultStatus: text("result_status").notNull(), // "deliverable" | "undeliverable" | ...
    score: real("score"), // provider のスコア
    regexpOk: integer("regexp_ok", { mode: "boolean" }),
    gibberish: integer("gibberish", { mode: "boolean" }),
    disposable: integer("disposable", { mode: "boolean" }),
    webmail: integer("webmail", { mode: "boolean" }),
    mxRecordsOk: integer("mx_records_ok", { mode: "boolean" }),
    smtpCheck: integer("smtp_check", { mode: "boolean" }),
    acceptAll: integer("accept_all", { mode: "boolean" }),
    block: integer("block", { mode: "boolean" }),
    reason: text("reason"), // UI用の簡易理由
    rawResponseJson: text("raw_response_json"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: index("idx_email_verifications_email_id").on(table.emailId),
    createdAtIdx: index("idx_email_verifications_created_at").on(
      table.createdAt,
    ),
  }),
);
