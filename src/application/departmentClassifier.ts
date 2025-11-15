import { DepartmentCategory } from "../domain/entities/department";

const normalizeDepartmentName = (name: string): string => {
  return name.replace(/\s+/g, "").toLowerCase();
};

export function classifyDepartmentName(name: string): DepartmentCategory {
  const normalized = normalizeDepartmentName(name);

  if (!normalized) {
    return "OTHER";
  }

  // 情報システム / DX 推進 系
  if (
    /情報システム|情シス|社内it|it基盤|インフラ|it企画|it推進|dx推進|デジタル推進|it戦略|デジタル戦略|テクノロジー本部|テクノロジー部/.test(
      normalized,
    )
  ) {
    return "IT_SYSTEMS_DX";
  }

  // 営業
  if (
    /営業|セールス|sales|アカウントマネージャ|アカウントマネジャ|インサイドセールス|フィールドセールス|法人営業|ソリューション営業/.test(
      normalized,
    )
  ) {
    return "SALES";
  }

  // マーケティング
  if (
    /マーケティング|マーケ|marketing|プロモーション|宣伝|広報|pr|ブランド|brand/.test(
      normalized,
    )
  ) {
    return "MARKETING";
  }

  // 人事
  if (
    /人事|hr|タレントマネジメント|組織開発|人材開発|採用|リクルート/.test(
      normalized,
    )
  ) {
    return "HR";
  }

  // 財務・経理
  if (
    /財務|経理|ファイナンス|finance|経営管理|管理会計|経営企画財務/.test(
      normalized,
    )
  ) {
    return "FINANCE";
  }

  return "OTHER";
}

export function getDepartmentCategorySearchInfo(department: string): {
  category: DepartmentCategory;
  relatedKeywords: string[];
} {
  const category = classifyDepartmentName(department);

  if (category === "IT_SYSTEMS_DX") {
    // 情報システム部で検索したときに DX 推進部なども
    // 同じバケツとして扱えるよう、代表的な表記ゆれをまとめておく。
    const relatedKeywords = [
      "情報システム部",
      "情報システム本部",
      "情報システム室",
      "情報システムグループ",
      "情シス",
      "社内IT",
      "IT基盤部",
      "IT企画部",
      "IT推進部",
      "IT戦略室",
      "DX推進部",
      "デジタル推進部",
      "デジタル戦略部",
      "テクノロジー本部",
      "テクノロジー部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "SALES") {
    const relatedKeywords = [
      "営業部",
      "営業本部",
      "営業部門",
      "法人営業部",
      "インサイドセールス",
      "フィールドセールス",
      "セールス",
      "アカウントマネージャー",
    ];
    return { category, relatedKeywords };
  }

  if (category === "MARKETING") {
    const relatedKeywords = [
      "マーケティング部",
      "マーケティング本部",
      "マーケ部",
      "デジタルマーケティング部",
      "プロモーション部",
      "宣伝部",
      "広報部",
      "PR部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "HR") {
    const relatedKeywords = [
      "人事部",
      "人事本部",
      "人材開発部",
      "組織開発部",
      "タレントマネジメント部",
      "採用部",
      "リクルート部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "FINANCE") {
    const relatedKeywords = [
      "財務部",
      "財務本部",
      "経理部",
      "経営管理部",
      "ファイナンス部",
      "管理会計部",
    ];
    return { category, relatedKeywords };
  }

  // 分類できなかった場合は、入力された部署名自体をキーワードとして扱う
  const trimmed = department.trim();
  return {
    category,
    relatedKeywords: trimmed ? [trimmed] : [],
  };
}
