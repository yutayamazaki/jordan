import { z } from 'zod';

// DBに保存する会社情報のエンティティ定義
export const Company = z.object({
  name: z.string(), // 会社名
  domain: z.string(), // メールドメイン（例: digeon.co）
});

export type Company = z.infer<typeof Company>;
