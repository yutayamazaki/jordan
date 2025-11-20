import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

let dbInstance: any | null = null;

export function getDb(dbPath: string = "data/jordan.sqlite"): any {
  if (dbInstance) {
    return dbInstance;
  }

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new (Database as any)(dbPath);
  db.pragma("journal_mode = WAL");

  initSchema(db);

  dbInstance = db;
  return dbInstance;
}

function initSchema(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      website_url TEXT,
      favicon_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position TEXT NOT NULL,
      department TEXT NOT NULL,
      department_category TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS email_candidates (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL,
      email TEXT NOT NULL,
      is_primary INTEGER NOT NULL,
      confidence REAL NOT NULL,
      type TEXT NOT NULL,
      pattern TEXT,
      is_deliverable INTEGER,
      has_mx_records INTEGER,
      verification_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id)
    );

    CREATE TABLE IF NOT EXISTS email_patterns (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      pattern TEXT NOT NULL,
      reason TEXT NOT NULL,
      domain TEXT,
      source TEXT,
      sample_email TEXT,
      verified_at TEXT,
      success_count INTEGER,
      total_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      is_deliverable INTEGER NOT NULL,
      has_mx_records INTEGER NOT NULL,
      reason TEXT,
      verified_at TEXT NOT NULL,
      source TEXT,
      mailbox_result TEXT,
      mailbox_reason TEXT,
      syntax_is_valid INTEGER,
      syntax_reason TEXT,
      domain_has_dns_record INTEGER,
      domain_has_mx_records INTEGER,
      inbox_quality_score REAL,
      send_recommendation TEXT,
      is_disposable_email_address INTEGER,
      is_spam_trap INTEGER,
      overall_risk_score REAL,
      hippo_trust_score REAL,
      hippo_trust_level TEXT,
      mail_server_location TEXT,
      mail_service_type_id TEXT,
      status TEXT,
      additional_status_info TEXT,
      domain_country_code TEXT,
      mail_server_country_code TEXT,
      raw_response_snippet TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_scans (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      company_domain TEXT NOT NULL,
      department TEXT NOT NULL,
      debug INTEGER NOT NULL,
      raw_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_search_caches (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      department TEXT NOT NULL,
      company_name TEXT,
      contacts_json TEXT NOT NULL,
      searched_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Add missing timestamp columns for existing databases (ignore errors if they already exist)
  const alterStatements = [
    "ALTER TABLE companies ADD COLUMN created_at TEXT",
    "ALTER TABLE companies ADD COLUMN updated_at TEXT",
    "ALTER TABLE contacts ADD COLUMN created_at TEXT",
    "ALTER TABLE contacts ADD COLUMN updated_at TEXT",
    "ALTER TABLE email_candidates ADD COLUMN created_at TEXT",
    "ALTER TABLE email_candidates ADD COLUMN updated_at TEXT",
    "ALTER TABLE email_patterns ADD COLUMN created_at TEXT",
    "ALTER TABLE email_patterns ADD COLUMN updated_at TEXT",
    "ALTER TABLE email_verifications ADD COLUMN created_at TEXT",
    "ALTER TABLE email_verifications ADD COLUMN updated_at TEXT",
    "ALTER TABLE company_scans ADD COLUMN updated_at TEXT",
    "ALTER TABLE contact_search_caches ADD COLUMN created_at TEXT",
    "ALTER TABLE contact_search_caches ADD COLUMN updated_at TEXT",
  ];

  for (const sql of alterStatements) {
    try {
      db.prepare(sql).run();
    } catch {
      // ignore if column already exists or table missing (older DBs)
    }
  }
}
