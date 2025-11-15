import { z } from "zod";

// 部署カテゴリの定義
// まずは「情報システム / DX 推進」まわりをきちんと束ねることを主目的とし、
// 将来的に必要になったらカテゴリを拡張できるようにしておく。
export const DepartmentCategorySchema = z.enum([
  "IT_SYSTEMS_DX", // 情報システム部 / 情シス / DX推進部 / IT戦略・デジタル推進系
  "SALES", // 営業部門
  "MARKETING", // マーケティング部門
  "HR", // 人事部門
  "FINANCE", // 財務・経理部門
  "OTHER", // 上記に当てはまらない、または分類不能な部署
]);

export type DepartmentCategory = z.infer<typeof DepartmentCategorySchema>;
