import { z } from "zod";
import { EmailSourceSchema } from "./emailAddress";

export const EmailPatternSchema = z.object({
  pattern: z.enum([
    "last",
    "first.last",
    "last.first",
    "first-last",
    "last-first",
    "first_last",
    "last_first",
    "firstlast",
    "lastfirst",
    "f.last",
    "f-last",
    "f_last",
    "flast",
  ]),
  reason: z.string(), // パターン特定の根拠となる情報
  // メールドメインから実際のパターンが見つかったかどうか
  // true: 実際の公開メールからパターンを特定できた
  // false: パターンを特定できず、アプリ側のデフォルトパターンを利用する
  found: z.boolean().default(true),
  // このパターン推定の根拠となった情報源（メールアドレスが掲載されていたページなど）
  sources: z.array(EmailSourceSchema).default([]),
});

export type EmailPattern = z.infer<typeof EmailPatternSchema>;
