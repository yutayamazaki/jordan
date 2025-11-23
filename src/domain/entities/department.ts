import { z } from "zod";

// 部署カテゴリの定義
export const DepartmentCategorySchema = z.enum([
  "経営",
  "人事・労務",
  "経理・財務",
  "法務",
  "購買",
  "営業",
  "マーケティング",
  "情報システム",
  "その他",
]);

export type DepartmentCategory = z.infer<typeof DepartmentCategorySchema>;
