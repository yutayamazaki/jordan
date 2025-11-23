import { DepartmentCategory } from "../domain/entities/department";

const normalizeDepartmentName = (name: string): string => {
  return name.replace(/\s+/g, "").toLowerCase();
};

export function classifyDepartmentName(name: string): DepartmentCategory {
  const normalized = normalizeDepartmentName(name);

  if (!normalized) {
    return "その他";
  }

  if (/経営|経営企画|事業企画|企画室|社長|代表|取締役|president|ceo|coo|cxo/.test(normalized)) {
    return "経営";
  }

  if (/人事|労務|hr|タレントマネジメント|組織開発|人材開発|採用|リクルート/.test(normalized)) {
    return "人事・労務";
  }

  if (/財務|経理|ファイナンス|finance|管理会計|経営管理|会計|経営企画財務/.test(normalized)) {
    return "経理・財務";
  }

  if (/法務|legal|リーガル|コンプライアンス|規制|契約/.test(normalized)) {
    return "法務";
  }

  if (/購買|調達|資材|仕入|バイヤ|procurement|purchase/.test(normalized)) {
    return "購買";
  }

  if (/営業|セールス|sales|アカウントマネージャ|アカウントマネジャ|インサイドセールス|フィールドセールス|法人営業|ソリューション営業/.test(normalized)) {
    return "営業";
  }

  if (/マーケティング|マーケ|marketing|プロモーション|宣伝|広報|pr|ブランド|brand/.test(normalized)) {
    return "マーケティング";
  }

  if (/情報システム|情シス|社内it|it基盤|インフラ|it企画|it推進|dx推進|デジタル推進|it戦略|デジタル戦略|テクノロジー本部|テクノロジー部|cio|cto/.test(normalized)) {
    return "情報システム";
  }

  return "その他";
}

export function getDepartmentCategorySearchInfo(department: string): {
  category: DepartmentCategory;
  relatedKeywords: string[];
} {
  const category = classifyDepartmentName(department);

  if (category === "経営") {
    const relatedKeywords = [
      "経営企画部",
      "事業企画部",
      "経営企画室",
      "社長室",
      "代表取締役",
      "経営管理部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "人事・労務") {
    const relatedKeywords = [
      "人事部",
      "人事本部",
      "労務部",
      "人材開発部",
      "組織開発部",
      "タレントマネジメント部",
      "採用部",
      "リクルート部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "経理・財務") {
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

  if (category === "法務") {
    const relatedKeywords = [
      "法務部",
      "法務本部",
      "リーガル部",
      "コンプライアンス部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "購買") {
    const relatedKeywords = [
      "購買部",
      "調達部",
      "資材部",
      "プロキュアメント部",
    ];
    return { category, relatedKeywords };
  }

  if (category === "営業") {
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

  if (category === "マーケティング") {
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

  if (category === "情報システム") {
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

  // 分類できなかった場合は、入力された部署名自体をキーワードとして扱う
  const trimmed = department.trim();
  return {
    category,
    relatedKeywords: trimmed ? [trimmed] : [],
  };
}
