import { z } from "zod";
import { EmailSourceSchema } from "./emailAddress";

// Web検索で取得する担当者情報のスキーマ定義
export const ContactResponseSchema = z.object({
  name: z.string(), // 氏名
  position: z.string(), // 役職
  department: z.string(), // 部署
  firstName: z.string(), // アルファベットの名
  lastName: z.string(), // アルファベットの姓
  // この担当者情報を取得したページ情報（URL とページタイトル）
  sources: z.array(EmailSourceSchema).default([]),
});

export type ContactResponse = z.infer<typeof ContactResponseSchema>;

// Web検索で取得する担当者情報のリストのスキーマ定義、実際にStructured Outputsで使用する
export const ContactListResponseSchema = z.object({
  contacts: z.array(ContactResponseSchema),
});

export type ContactListResponse = z.infer<typeof ContactListResponseSchema>;
