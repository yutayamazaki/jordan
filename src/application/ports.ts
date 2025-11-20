import { EmailPattern } from "../domain/entities/emailPattern";
import { CompanyRecord, ContactRecord, EmailCandidateRecord, EmailPatternRecord } from "../domain";
import { ContactResponse } from "../domain/entities/contact";
import type { ContactSearchCachesRecord } from "../domain/entities/contactSearchCaches";
import { Result } from "neverthrow";

export type EmailVerificationSource = "dns_mx" | "email_hippo";

export type EmailHippoMailboxResult =
  | "Ok"
  | "Bad"
  | "CatchAll"
  | "Unknown"
  | string;

export type EmailHippoSendRecommendation =
  | "SafeToSend"
  | "TreatWithCaution"
  | "DoNotSend"
  | string;

export type EmailHippoTrustLevel = "High" | "Medium" | "Low" | string;

export type EmailVerificationResult = {
  // 共通フィールド
  email: string;
  isDeliverable: boolean;
  hasMxRecords: boolean;
  reason?: string;

  // 検証ソース
  source: EmailVerificationSource;

  // EmailHippo メールボックス検証
  mailboxResult?: EmailHippoMailboxResult;
  mailboxReason?: string;

  // シンタックス / DNS
  syntaxIsValid?: boolean;
  syntaxReason?: string;
  domainHasDnsRecord?: boolean;
  domainHasMxRecords?: boolean;

  // 送信品質・推奨
  inboxQualityScore?: number;
  sendRecommendation?: EmailHippoSendRecommendation;

  // スパム・リスク
  isDisposableEmailAddress?: boolean;
  isSpamTrap?: boolean;
  overallRiskScore?: number;

  // 信頼スコア
  hippoTrustScore?: number;
  hippoTrustLevel?: EmailHippoTrustLevel;

  // インフラ情報
  mailServerLocation?: string;
  mailServiceTypeId?: string;

  // 国情報（CSV や API から取得できる場合）
  status?: string;
  additionalStatusInfo?: string;
  domainCountryCode?: string;
  mailServerCountryCode?: string;

  // デバッグ用の生レスポンス断片
  rawResponseSnippet?: string;
};

export interface EmailPatternDetector {
  detect(domain: string): Promise<Result<EmailPattern | null, Error>>;
}

export interface ContactFinder {
  searchContacts(
    companyName: string,
    domain: string,
    department: string,
  ): Promise<Result<ContactResponse[], Error>>;
}

export interface ContactSearchCachesRepository {
  findRecent(
    domain: string,
    department: string,
    maxAgeDays: number,
  ): Promise<ContactSearchCachesRecord | null>;
  save(record: ContactSearchCachesRecord): Promise<void>;
}

export interface EmailVerifier {
  verify(email: string): Promise<EmailVerificationResult>;
}

export interface EmailVerificationRepository {
  findRecent(
    email: string,
    maxAgeDays: number,
  ): Promise<EmailVerificationResult | null>;
  save(result: EmailVerificationResult): Promise<void>;
}

export interface EmailPatternRepository {
  findRecentByDomain(
    domain: string,
    maxAgeDays: number,
  ): Promise<EmailPatternRecord | null>;
  save(record: EmailPatternRecord): Promise<void>;
}

export interface LeadExporter {
  export(
    domain: string,
    companyRecords: CompanyRecord[],
    contactRecords: ContactRecord[],
    emailCandidateRecords: EmailCandidateRecord[],
    emailPatternRecords: EmailPatternRecord[],
  ): Promise<void>;
}

export interface IdGenerator {
  generate(): string;
}
