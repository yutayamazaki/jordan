import { CompanyScanRawData, CompanyScanRawStore } from "../application/runCompanyScan";
import { getDb } from "./sqliteClient";

export class SqliteCompanyScanRawStore implements CompanyScanRawStore {
  async save(raw: CompanyScanRawData): Promise<void> {
    const db = getDb();
    const nowIso = new Date().toISOString();

    const json = JSON.stringify(raw);

    db.prepare(
      `
      INSERT INTO company_scans (
        id,
        company_id,
        company_name,
        company_domain,
        department,
        debug,
        raw_json,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @company_id,
        @company_name,
        @company_domain,
        @department,
        @debug,
        @raw_json,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        company_domain = excluded.company_domain,
        department = excluded.department,
        debug = excluded.debug,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at
      `,
    ).run({
      id: raw.companyId,
      company_id: raw.companyId,
      company_name: raw.company.name,
      company_domain: raw.company.domain,
      department: raw.department,
      debug: 0,
      raw_json: json,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  async load(domain: string, department: string): Promise<CompanyScanRawData | null> {
    const db = getDb();

    const row = db
      .prepare(
        `
        SELECT raw_json
        FROM company_scans
        WHERE company_domain = ? AND department = ?
        ORDER BY created_at DESC
        LIMIT 1
        `,
      )
      .get(domain, department) as { raw_json: string } | undefined;

    if (!row) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.raw_json) as CompanyScanRawData;
      return parsed;
    } catch {
      return null;
    }
  }
}
