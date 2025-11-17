import { randomUUID } from "crypto";
import { EmailVerificationRepository, EmailVerificationResult } from "../application/ports";
import {
  EmailVerificationRecord,
  EmailVerificationRecordSchema,
} from "../domain";
import { getDb } from "./sqliteClient";

function isWithinDays(date: Date, days: number): boolean {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const limitMs = days * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= limitMs;
}

export class SqliteEmailVerificationRepository implements EmailVerificationRepository {
  async findRecent(email: string, maxAgeDays: number): Promise<EmailVerificationResult | null> {
    const db = getDb();

    const row = db
      .prepare(
        `
        SELECT *
        FROM email_verifications
        WHERE email = ?
        ORDER BY verified_at DESC
        LIMIT 1
        `,
      )
      .get(email) as any | undefined;

    if (!row) {
      return null;
    }

    const verifiedAt = new Date(row.verified_at);
    if (!isWithinDays(verifiedAt, maxAgeDays)) {
      return null;
    }

    const record: EmailVerificationRecord = EmailVerificationRecordSchema.parse({
      id: row.id,
      email: row.email,
      isDeliverable: !!row.is_deliverable,
      hasMxRecords: !!row.has_mx_records,
      reason: row.reason ?? undefined,
      verifiedAt: row.verified_at,
      source: row.source ?? undefined,
      mailboxResult: row.mailbox_result ?? undefined,
      mailboxReason: row.mailbox_reason ?? undefined,
      syntaxIsValid: row.syntax_is_valid === null ? undefined : !!row.syntax_is_valid,
      syntaxReason: row.syntax_reason ?? undefined,
      domainHasDnsRecord:
        row.domain_has_dns_record === null ? undefined : !!row.domain_has_dns_record,
      domainHasMxRecords:
        row.domain_has_mx_records === null ? undefined : !!row.domain_has_mx_records,
      inboxQualityScore:
        row.inbox_quality_score === null ? undefined : Number(row.inbox_quality_score),
      sendRecommendation: row.send_recommendation ?? undefined,
      isDisposableEmailAddress:
        row.is_disposable_email_address === null
          ? undefined
          : !!row.is_disposable_email_address,
      isSpamTrap: row.is_spam_trap === null ? undefined : !!row.is_spam_trap,
      overallRiskScore:
        row.overall_risk_score === null ? undefined : Number(row.overall_risk_score),
      hippoTrustScore:
        row.hippo_trust_score === null ? undefined : Number(row.hippo_trust_score),
      hippoTrustLevel: row.hippo_trust_level ?? undefined,
      mailServerLocation: row.mail_server_location ?? undefined,
      mailServiceTypeId: row.mail_service_type_id ?? undefined,
      status: row.status ?? undefined,
      additionalStatusInfo: row.additional_status_info ?? undefined,
      domainCountryCode: row.domain_country_code ?? undefined,
      mailServerCountryCode: row.mail_server_country_code ?? undefined,
      rawResponseSnippet: row.raw_response_snippet ?? undefined,
    });

    return {
      email: record.email,
      isDeliverable: record.isDeliverable,
      hasMxRecords: record.hasMxRecords,
      reason: record.reason,
      source: record.source ?? "dns_mx",
      mailboxResult: record.mailboxResult,
      mailboxReason: record.mailboxReason,
      syntaxIsValid: record.syntaxIsValid,
      syntaxReason: record.syntaxReason,
      domainHasDnsRecord: record.domainHasDnsRecord,
      domainHasMxRecords: record.domainHasMxRecords,
      inboxQualityScore: record.inboxQualityScore,
      sendRecommendation: record.sendRecommendation,
      isDisposableEmailAddress: record.isDisposableEmailAddress,
      isSpamTrap: record.isSpamTrap,
      overallRiskScore: record.overallRiskScore,
      hippoTrustScore: record.hippoTrustScore,
      hippoTrustLevel: record.hippoTrustLevel,
      mailServerLocation: record.mailServerLocation ?? undefined,
      mailServiceTypeId: record.mailServiceTypeId,
      status: record.status,
      additionalStatusInfo: record.additionalStatusInfo,
      domainCountryCode: record.domainCountryCode,
      mailServerCountryCode: record.mailServerCountryCode,
      rawResponseSnippet: record.rawResponseSnippet,
    };
  }

  async save(result: EmailVerificationResult): Promise<void> {
    const db = getDb();
    const nowIso = new Date().toISOString();
    const id = randomUUID();

    const record: EmailVerificationRecord = EmailVerificationRecordSchema.parse({
      id,
      email: result.email,
      isDeliverable: result.isDeliverable,
      hasMxRecords: result.hasMxRecords,
      reason: result.reason,
      verifiedAt: nowIso,
      source: result.source,
      mailboxResult: result.mailboxResult,
      mailboxReason: result.mailboxReason,
      syntaxIsValid: result.syntaxIsValid,
      syntaxReason: result.syntaxReason,
      domainHasDnsRecord: result.domainHasDnsRecord,
      domainHasMxRecords: result.domainHasMxRecords,
      inboxQualityScore: result.inboxQualityScore,
      sendRecommendation: result.sendRecommendation,
      isDisposableEmailAddress: result.isDisposableEmailAddress,
      isSpamTrap: result.isSpamTrap,
      overallRiskScore: result.overallRiskScore,
      hippoTrustScore: result.hippoTrustScore,
      hippoTrustLevel: result.hippoTrustLevel,
      mailServerLocation: result.mailServerLocation,
      mailServiceTypeId: result.mailServiceTypeId,
      status: result.status,
      additionalStatusInfo: result.additionalStatusInfo,
      domainCountryCode: result.domainCountryCode,
      mailServerCountryCode: result.mailServerCountryCode,
      rawResponseSnippet: result.rawResponseSnippet,
    });

    db.prepare(
      `
      INSERT INTO email_verifications (
        id,
        email,
        is_deliverable,
        has_mx_records,
        reason,
        verified_at,
        source,
        mailbox_result,
        mailbox_reason,
        syntax_is_valid,
        syntax_reason,
        domain_has_dns_record,
        domain_has_mx_records,
        inbox_quality_score,
        send_recommendation,
        is_disposable_email_address,
        is_spam_trap,
        overall_risk_score,
        hippo_trust_score,
        hippo_trust_level,
        mail_server_location,
        mail_service_type_id,
        status,
        additional_status_info,
        domain_country_code,
        mail_server_country_code,
        raw_response_snippet
      )
      VALUES (
        @id,
        @email,
        @is_deliverable,
        @has_mx_records,
        @reason,
        @verified_at,
        @source,
        @mailbox_result,
        @mailbox_reason,
        @syntax_is_valid,
        @syntax_reason,
        @domain_has_dns_record,
        @domain_has_mx_records,
        @inbox_quality_score,
        @send_recommendation,
        @is_disposable_email_address,
        @is_spam_trap,
        @overall_risk_score,
        @hippo_trust_score,
        @hippo_trust_level,
        @mail_server_location,
        @mail_service_type_id,
        @status,
        @additional_status_info,
        @domain_country_code,
        @mail_server_country_code,
        @raw_response_snippet
      )
      `,
    ).run({
      id: record.id,
      email: record.email,
      is_deliverable: record.isDeliverable ? 1 : 0,
      has_mx_records: record.hasMxRecords ? 1 : 0,
      reason: record.reason ?? null,
      verified_at: record.verifiedAt,
      source: record.source ?? null,
      mailbox_result: record.mailboxResult ?? null,
      mailbox_reason: record.mailboxReason ?? null,
      syntax_is_valid:
        typeof record.syntaxIsValid === "boolean" ? (record.syntaxIsValid ? 1 : 0) : null,
      syntax_reason: record.syntaxReason ?? null,
      domain_has_dns_record:
        typeof record.domainHasDnsRecord === "boolean"
          ? record.domainHasDnsRecord
            ? 1
            : 0
          : null,
      domain_has_mx_records:
        typeof record.domainHasMxRecords === "boolean"
          ? record.domainHasMxRecords
            ? 1
            : 0
          : null,
      inbox_quality_score:
        typeof record.inboxQualityScore === "number" ? record.inboxQualityScore : null,
      send_recommendation: record.sendRecommendation ?? null,
      is_disposable_email_address:
        typeof record.isDisposableEmailAddress === "boolean"
          ? record.isDisposableEmailAddress
            ? 1
            : 0
          : null,
      is_spam_trap:
        typeof record.isSpamTrap === "boolean" ? (record.isSpamTrap ? 1 : 0) : null,
      overall_risk_score:
        typeof record.overallRiskScore === "number" ? record.overallRiskScore : null,
      hippo_trust_score:
        typeof record.hippoTrustScore === "number" ? record.hippoTrustScore : null,
      hippo_trust_level: record.hippoTrustLevel ?? null,
      mail_server_location: record.mailServerLocation ?? null,
      mail_service_type_id: record.mailServiceTypeId ?? null,
      status: record.status ?? null,
      additional_status_info: record.additionalStatusInfo ?? null,
      domain_country_code: record.domainCountryCode ?? null,
      mail_server_country_code: record.mailServerCountryCode ?? null,
      raw_response_snippet: record.rawResponseSnippet ?? null,
    });
  }
}
