import { randomUUID } from "crypto";
import { EmailPatternRepository } from "../application/ports";
import {
  EmailPatternRecord,
  EmailPatternRecordSchema,
} from "../domain";
import { getDb } from "./sqliteClient";

function isWithinDays(date: Date, days: number): boolean {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const limitMs = days * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= limitMs;
}

export class SqliteEmailPatternRepository implements EmailPatternRepository {
  async findRecentByDomain(
    domain: string,
    maxAgeDays: number,
  ): Promise<EmailPatternRecord | null> {
    const db = getDb();

    const rows = db
      .prepare(
        `
        SELECT *
        FROM email_patterns
        WHERE domain = ?
        `,
      )
      .all(domain) as any[];

    if (!rows || rows.length === 0) {
      return null;
    }

    const parsed = rows
      .map((row) => {
        const result = EmailPatternRecordSchema.safeParse({
          id: row.id,
          companyId: row.company_id,
          pattern: row.pattern,
          reason: row.reason,
          domain: row.domain ?? undefined,
          source: row.source ?? undefined,
          sampleEmail: row.sample_email ?? undefined,
          verifiedAt: row.verified_at ?? undefined,
          successCount:
            row.success_count === null || row.success_count === undefined
              ? undefined
              : Number(row.success_count),
          totalCount:
            row.total_count === null || row.total_count === undefined
              ? undefined
              : Number(row.total_count),
        });
        if (!result.success) {
          return null;
        }
        return result.data;
      })
      .filter((r): r is EmailPatternRecord => r !== null);

    if (parsed.length === 0) {
      return null;
    }

    const withDate = parsed
      .map((r) => ({
        record: r,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt) : null,
      }))
      .filter(
        (x): x is { record: EmailPatternRecord; verifiedAt: Date } =>
          x.verifiedAt !== null,
      );

    if (withDate.length === 0) {
      return null;
    }

    withDate.sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime());

    const latest = withDate[0];
    if (!isWithinDays(latest.verifiedAt, maxAgeDays)) {
      return null;
    }

    return latest.record;
  }

  async save(record: EmailPatternRecord): Promise<void> {
    const db = getDb();

    const nowIso = new Date().toISOString();

    const existingRow = db
      .prepare(
        `
        SELECT *
        FROM email_patterns
        WHERE domain = @domain AND pattern = @pattern
        LIMIT 1
        `,
      )
      .get({
        domain: record.domain ?? null,
        pattern: record.pattern,
      }) as any | undefined;

    const existing: EmailPatternRecord | null = existingRow
      ? EmailPatternRecordSchema.parse({
          id: existingRow.id,
          companyId: existingRow.company_id,
          pattern: existingRow.pattern,
          reason: existingRow.reason,
          domain: existingRow.domain ?? undefined,
          source: existingRow.source ?? undefined,
          sampleEmail: existingRow.sample_email ?? undefined,
          verifiedAt: existingRow.verified_at ?? undefined,
          successCount:
            existingRow.success_count === null ||
            existingRow.success_count === undefined
              ? undefined
              : Number(existingRow.success_count),
          totalCount:
            existingRow.total_count === null ||
            existingRow.total_count === undefined
              ? undefined
              : Number(existingRow.total_count),
        })
      : null;

    const successCount =
      (existing?.successCount ?? 0) + (record.successCount ?? 0);
    const totalCount =
      (existing?.totalCount ?? 0) + (record.totalCount ?? 0);

    const nextRecord: EmailPatternRecord = EmailPatternRecordSchema.parse({
      id: record.id ?? existing?.id ?? randomUUID(),
      companyId: record.companyId,
      pattern: record.pattern,
      reason: record.reason,
      domain: record.domain,
      source: record.source,
      sampleEmail: record.sampleEmail ?? existing?.sampleEmail,
      verifiedAt: record.verifiedAt ?? existing?.verifiedAt ?? nowIso,
      successCount,
      totalCount,
    });

    db.prepare(
      `
      INSERT INTO email_patterns (
        id,
        company_id,
        pattern,
        reason,
        domain,
        source,
        sample_email,
        verified_at,
        success_count,
        total_count,
        created_at,
        updated_at
      )
      VALUES (
        @id,
        @company_id,
        @pattern,
        @reason,
        @domain,
        @source,
        @sample_email,
        @verified_at,
        @success_count,
        @total_count,
        @created_at,
        @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        pattern = excluded.pattern,
        reason = excluded.reason,
        domain = excluded.domain,
        source = excluded.source,
        sample_email = excluded.sample_email,
        verified_at = excluded.verified_at,
        success_count = excluded.success_count,
        total_count = excluded.total_count,
        updated_at = excluded.updated_at
      `,
    ).run({
      id: nextRecord.id,
      company_id: nextRecord.companyId,
      pattern: nextRecord.pattern,
      reason: nextRecord.reason,
      domain: nextRecord.domain ?? null,
      source: nextRecord.source ?? null,
      sample_email: nextRecord.sampleEmail ?? null,
      verified_at: nextRecord.verifiedAt ?? null,
      success_count:
        typeof nextRecord.successCount === "number"
          ? nextRecord.successCount
          : null,
      total_count:
        typeof nextRecord.totalCount === "number"
          ? nextRecord.totalCount
          : null,
      created_at: existing ? existing.verifiedAt ?? nowIso : nowIso,
      updated_at: nowIso,
    });
  }
}
