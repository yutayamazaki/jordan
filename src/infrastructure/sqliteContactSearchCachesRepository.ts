import { randomUUID } from "crypto";
import { ContactSearchCachesRepository } from "../application/ports";
import {
  ContactSearchCachesRecord,
  ContactSearchCachesRecordSchema,
} from "../domain/entities/contactSearchCaches";
import { ContactResponseSchema } from "../domain/entities/contact";
import { getDb } from "./sqliteClient";

function isWithinDays(date: Date, days: number): boolean {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const limitMs = days * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= limitMs;
}

export class SqliteContactSearchCachesRepository
  implements ContactSearchCachesRepository
{
  async findRecent(
    domain: string,
    department: string,
    maxAgeDays: number,
  ): Promise<ContactSearchCachesRecord | null> {
    const db = getDb();

    const row = db
      .prepare(
        `
        SELECT *
        FROM contact_search_caches
        WHERE domain = ?
          AND department = ?
        ORDER BY searched_at DESC
        LIMIT 1
        `,
      )
      .get(domain, department) as any | undefined;

    if (!row) {
      return null;
    }

    const searchedAt = new Date(row.searched_at);
    if (!isWithinDays(searchedAt, maxAgeDays)) {
      return null;
    }

    let contacts: unknown;
    try {
      contacts = JSON.parse(row.contacts_json);
    } catch {
      return null;
    }

    const contactsResult = ContactResponseSchema.array().safeParse(contacts);
    if (!contactsResult.success) {
      return null;
    }

    const recordResult = ContactSearchCachesRecordSchema.safeParse({
      id: row.id,
      domain: row.domain,
      department: row.department,
      companyName: row.company_name ?? undefined,
      contacts: contactsResult.data,
      searchedAt: row.searched_at,
    });

    if (!recordResult.success) {
      return null;
    }

    return recordResult.data;
  }

  async save(record: ContactSearchCachesRecord): Promise<void> {
    const db = getDb();

    const id = record.id || randomUUID();
    const searchedAtIso = record.searchedAt || new Date().toISOString();

    const parsed = ContactSearchCachesRecordSchema.parse({
      ...record,
      id,
      searchedAt: searchedAtIso,
    });

    const contactsJson = JSON.stringify(parsed.contacts);

    db.prepare(
      `
      INSERT INTO contact_search_caches (
        id,
        domain,
        department,
        company_name,
        contacts_json,
        searched_at
      )
      VALUES (
        @id,
        @domain,
        @department,
        @company_name,
        @contacts_json,
        @searched_at
      )
      ON CONFLICT(id) DO UPDATE SET
        domain = excluded.domain,
        department = excluded.department,
        company_name = excluded.company_name,
        contacts_json = excluded.contacts_json,
        searched_at = excluded.searched_at
      `,
    ).run({
      id: parsed.id,
      domain: parsed.domain,
      department: parsed.department,
      company_name: parsed.companyName ?? null,
      contacts_json: contactsJson,
      searched_at: parsed.searchedAt,
    });
  }
}

