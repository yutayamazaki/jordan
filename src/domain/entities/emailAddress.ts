import { z } from "zod";

// personal: 個人用メールアドレス
// generic: 汎用メールアドレス（例: info@, support@）
// role: 役職・役割に紐づくメールアドレス（例: ceo@, hr@）
// unknown: 不明
export const EmailTypeSchema = z.enum(["personal", "generic", "role", "unknown"]);
export type EmailType = z.infer<typeof EmailTypeSchema>;

// メールアドレスがどのページから得られたか
// url: 取得元ページのURL（取得できない場合は null）
// pageTitle: 取得元ページのタイトル（取得できない場合は null）
export const EmailSourceSchema = z.object({
  // Structured Outputs の制約に合わせて format を付けない素の文字列にする
  url: z.string().nullable(),
  pageTitle: z.string().nullable(),
});

export type EmailSource = z.infer<typeof EmailSourceSchema>;

export const EmailAddressSchema = z.object({
  value: z.string(),
  type: EmailTypeSchema,
  pattern: z.string().optional(),
  sources: z.array(EmailSourceSchema).default([]),
});

export type EmailAddress = z.infer<typeof EmailAddressSchema>;

export const EmailCandidateSchema = z.object({
  primary: EmailAddressSchema,
  alternatives: z.array(EmailAddressSchema),
  // この候補を導き出す際に参照したページ情報
  sources: z.array(EmailSourceSchema).default([]),
});

export type EmailCandidate = z.infer<typeof EmailCandidateSchema>;
