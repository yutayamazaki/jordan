import { z } from "zod";
import { EmailPatternSchema } from "./entities/emailPattern";

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
  firstName: z.string(),
  lastName: z.string(),
});

export type ContactRecord = z.infer<typeof ContactSchema>;

// DB に保存するための EmailCandidates テーブル用スキーマ
export const EmailCandidateSchema = z.object({
  id: z.uuid(),
  contactId: z.uuid(),
  email: z.string(),
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
