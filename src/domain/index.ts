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
});

export type EmailVerificationRecord = z.infer<typeof EmailVerificationRecordSchema>;
