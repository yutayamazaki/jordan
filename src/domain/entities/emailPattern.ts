import { z } from "zod";

export const EmailPatternSchema = z.object({
  pattern: z.enum([
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
  reason: z.string(),
  // メールドメインから実際のパターンが見つかったかどうか
  // true: 実際の公開メールからパターンを特定できた
  // false: パターンを特定できず、アプリ側のデフォルトパターンを利用する
  found: z.boolean().default(true),
});

export type EmailPattern = z.infer<typeof EmailPatternSchema>;
