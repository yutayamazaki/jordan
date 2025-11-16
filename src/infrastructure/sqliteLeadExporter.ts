import { LeadExporter } from "../application/ports";
import {
  CompanyRecord,
  ContactRecord,
  EmailCandidateRecord,
  EmailPatternRecord,
} from "../domain";
import { getDb } from "./sqliteClient";

export class SqliteLeadExporter implements LeadExporter {
  async export(
    _domain: string,
    companyRecords: CompanyRecord[],
    contactRecords: ContactRecord[],
    emailCandidateRecords: EmailCandidateRecord[],
    emailPatternRecords: EmailPatternRecord[],
  ): Promise<void> {
    const db = getDb();

    const insertCompany = db.prepare(`
      INSERT INTO companies (id, name, domain)
      VALUES (@id, @name, @domain)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        domain = excluded.domain
    `);

    const insertContact = db.prepare(`
      INSERT INTO contacts (
        id,
        company_id,
        name,
        position,
        department,
        department_category,
        first_name,
        last_name
      )
      VALUES (
        @id,
        @company_id,
        @name,
        @position,
        @department,
        @department_category,
        @first_name,
        @last_name
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        name = excluded.name,
        position = excluded.position,
        department = excluded.department,
        department_category = excluded.department_category,
        first_name = excluded.first_name,
        last_name = excluded.last_name
    `);

    const insertEmailCandidate = db.prepare(`
      INSERT INTO email_candidates (
        id,
        contact_id,
        email,
        is_primary,
        confidence,
        type,
        pattern,
        is_deliverable,
        has_mx_records,
        verification_reason
      )
      VALUES (
        @id,
        @contact_id,
        @email,
        @is_primary,
        @confidence,
        @type,
        @pattern,
        @is_deliverable,
        @has_mx_records,
        @verification_reason
      )
      ON CONFLICT(id) DO UPDATE SET
        contact_id = excluded.contact_id,
        email = excluded.email,
        is_primary = excluded.is_primary,
        confidence = excluded.confidence,
        type = excluded.type,
        pattern = excluded.pattern,
        is_deliverable = excluded.is_deliverable,
        has_mx_records = excluded.has_mx_records,
        verification_reason = excluded.verification_reason
    `);

    const insertEmailPattern = db.prepare(`
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
        total_count
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
        @total_count
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
        total_count = excluded.total_count
    `);

    const tx = db.transaction(() => {
      for (const company of companyRecords) {
        insertCompany.run({
          id: company.id,
          name: company.name,
          domain: company.domain,
        });
      }

      for (const contact of contactRecords) {
        insertContact.run({
          id: contact.id,
          company_id: contact.companyId,
          name: contact.name,
          position: contact.position,
          department: contact.department,
          department_category: contact.departmentCategory,
          first_name: contact.firstName,
          last_name: contact.lastName,
        });
      }

      for (const candidate of emailCandidateRecords) {
        insertEmailCandidate.run({
          id: candidate.id,
          contact_id: candidate.contactId,
          email: candidate.email,
          is_primary: candidate.isPrimary ? 1 : 0,
          confidence: candidate.confidence,
          type: candidate.type,
          pattern: candidate.pattern ?? null,
          is_deliverable:
            typeof candidate.isDeliverable === "boolean"
              ? candidate.isDeliverable
                ? 1
                : 0
              : null,
          has_mx_records:
            typeof candidate.hasMxRecords === "boolean"
              ? candidate.hasMxRecords
                ? 1
                : 0
              : null,
          verification_reason: candidate.verificationReason ?? null,
        });
      }

      for (const pattern of emailPatternRecords) {
        insertEmailPattern.run({
          id: pattern.id,
          company_id: pattern.companyId,
          pattern: pattern.pattern,
          reason: pattern.reason,
          domain: pattern.domain ?? null,
          source: pattern.source ?? null,
          sample_email: pattern.sampleEmail ?? null,
          verified_at: pattern.verifiedAt ?? null,
          success_count:
            typeof pattern.successCount === "number" ? pattern.successCount : null,
          total_count:
            typeof pattern.totalCount === "number" ? pattern.totalCount : null,
        });
      }
    });

    tx();
  }
}

