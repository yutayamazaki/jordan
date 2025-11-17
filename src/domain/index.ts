import { z } from "zod";
import { EmailPatternSchema } from "./entities/emailPattern";
import { EmailTypeSchema } from "./entities/emailAddress";
import { DepartmentCategorySchema } from "./entities/department";

// DB に保存するための Company テーブル用スキーマ
export const CompanySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  domain: z.string(),
});

export type CompanyRecord = z.infer<typeof CompanySchema>;

// DB に保存するための Contact テーブル用スキーマ
export const ContactSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  name: z.string(),
  position: z.string(),
  department: z.string(),
   departmentCategory: DepartmentCategorySchema,
  firstName: z.string(),
  lastName: z.string(),
});

export type ContactRecord = z.infer<typeof ContactSchema>;

// DB に保存するための EmailCandidates テーブル用スキーマ
export const EmailCandidateSchema = z.object({
  id: z.uuid(),
  contactId: z.uuid(),
  email: z.string(),
  isPrimary: z.boolean(),
  confidence: z.number(),
  type: EmailTypeSchema,
  pattern: EmailPatternSchema.shape.pattern.optional(),
  isDeliverable: z.boolean().optional(),
  hasMxRecords: z.boolean().optional(),
  verificationReason: z.string().optional(),
});

export type EmailCandidateRecord = z.infer<typeof EmailCandidateSchema>;

// DB に保存するための EmailPattern テーブル用スキーマ
export const EmailPatternRecordSchema = z.object({
  id: z.uuid(),
  companyId: z.uuid(),
  pattern: EmailPatternSchema.shape.pattern,
  reason: z.string(),
  // 過去学習したパターンを保存するためのメタ情報（任意）
  domain: z.string().optional(),
  source: z.enum(["llm", "email_hippo"]).optional(),
  sampleEmail: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  successCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
});

export type EmailPatternRecord = z.infer<typeof EmailPatternRecordSchema>;

// DB に保存するための EmailVerification テーブル用スキーマ
export const EmailVerificationRecordSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  isDeliverable: z.boolean(),
  hasMxRecords: z.boolean(),
  reason: z.string().optional(),
  verifiedAt: z.string().datetime(),
  source: z.enum(["dns_mx", "email_hippo"]).optional(),
  mailboxResult: z.string().optional(),
  mailboxReason: z.string().optional(),
  syntaxIsValid: z.boolean().optional(),
  syntaxReason: z.string().optional(),
  domainHasDnsRecord: z.boolean().optional(),
  domainHasMxRecords: z.boolean().optional(),
  inboxQualityScore: z.number().optional(),
  sendRecommendation: z.string().optional(),
  isDisposableEmailAddress: z.boolean().optional(),
  isSpamTrap: z.boolean().optional(),
  overallRiskScore: z.number().optional(),
  hippoTrustScore: z.number().optional(),
  hippoTrustLevel: z.string().optional(),
  mailServerLocation: z.string().nullable().optional(),
  mailServiceTypeId: z.string().optional(),
  status: z.string().optional(),
  additionalStatusInfo: z.string().optional(),
  domainCountryCode: z.string().optional(),
  mailServerCountryCode: z.string().optional(),
  rawResponseSnippet: z.string().optional(),
});

export type EmailVerificationRecord = z.infer<typeof EmailVerificationRecordSchema>;
