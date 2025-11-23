import { describe, it, expect } from "vitest";
import {
  classifyDepartmentName,
  getDepartmentCategorySearchInfo,
} from "./departmentClassifier";

describe("classifyDepartmentName", () => {
  it("classifies management related departments as 経営", () => {
    expect(classifyDepartmentName("経営企画部")).toBe("経営");
    expect(classifyDepartmentName("事業企画部")).toBe("経営");
    expect(classifyDepartmentName("社長室")).toBe("経営");
    expect(classifyDepartmentName("CEO Office")).toBe("経営");
  });

  it("classifies IT / DX related departments as 情報システム", () => {
    expect(classifyDepartmentName("情報システム部")).toBe("情報システム");
    expect(classifyDepartmentName("情シス")).toBe("情報システム");
    expect(classifyDepartmentName("DX推進部")).toBe("情報システム");
    expect(classifyDepartmentName("テクノロジー本部")).toBe("情報システム");
    expect(classifyDepartmentName("社内 IT")).toBe("情報システム");
  });

  it("classifies sales departments as 営業", () => {
    expect(classifyDepartmentName("営業部")).toBe("営業");
    expect(classifyDepartmentName("インサイドセールス")).toBe("営業");
    expect(classifyDepartmentName("フィールドセールス")).toBe("営業");
    expect(classifyDepartmentName("法人営業部")).toBe("営業");
  });

  it("classifies marketing departments as マーケティング", () => {
    expect(classifyDepartmentName("マーケティング部")).toBe("マーケティング");
    expect(classifyDepartmentName("マーケ部")).toBe("マーケティング");
    expect(classifyDepartmentName("プロモーション部")).toBe("マーケティング");
    expect(classifyDepartmentName("広報部")).toBe("マーケティング");
  });

  it("classifies HR departments as 人事・労務", () => {
    expect(classifyDepartmentName("人事部")).toBe("人事・労務");
    expect(classifyDepartmentName("人材開発部")).toBe("人事・労務");
    expect(classifyDepartmentName("組織開発部")).toBe("人事・労務");
    expect(classifyDepartmentName("採用部")).toBe("人事・労務");
  });

  it("classifies finance related departments as 経理・財務", () => {
    expect(classifyDepartmentName("財務部")).toBe("経理・財務");
    expect(classifyDepartmentName("経理部")).toBe("経理・財務");
    expect(classifyDepartmentName("ファイナンス部")).toBe("経理・財務");
    expect(classifyDepartmentName("経営管理部")).toBe("経理・財務");
  });

  it("classifies legal departments as 法務", () => {
    expect(classifyDepartmentName("法務部")).toBe("法務");
    expect(classifyDepartmentName("コンプライアンス部")).toBe("法務");
    expect(classifyDepartmentName("Legal Division")).toBe("法務");
  });

  it("classifies procurement departments as 購買", () => {
    expect(classifyDepartmentName("購買部")).toBe("購買");
    expect(classifyDepartmentName("調達部")).toBe("購買");
    expect(classifyDepartmentName("資材部")).toBe("購買");
  });

  it("returns その他 for empty or unknown department names", () => {
    expect(classifyDepartmentName("")).toBe("その他");
    expect(classifyDepartmentName("   ")).toBe("その他");
    expect(classifyDepartmentName("カスタマーサクセス部")).toBe("その他");
  });
});

describe("getDepartmentCategorySearchInfo", () => {
  it("returns related keywords for 経営", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("経営企画部");

    expect(category).toBe("経営");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("経営企画部");
    expect(relatedKeywords).toContain("社長室");
  });

  it("returns related keywords for 情報システム", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("情報システム部");

    expect(category).toBe("情報システム");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("情報システム部");
    expect(relatedKeywords).toContain("DX推進部");
    expect(relatedKeywords).toContain("テクノロジー本部");
  });

  it("returns related keywords for 営業", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("営業部");

    expect(category).toBe("営業");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("営業部");
    expect(relatedKeywords).toContain("法人営業部");
    expect(relatedKeywords).toContain("インサイドセールス");
  });

  it("returns related keywords for マーケティング", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("マーケティング部");

    expect(category).toBe("マーケティング");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("マーケティング部");
    expect(relatedKeywords).toContain("プロモーション部");
    expect(relatedKeywords).toContain("広報部");
  });

  it("returns related keywords for 人事・労務", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("人事部");

    expect(category).toBe("人事・労務");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("人事部");
    expect(relatedKeywords).toContain("人材開発部");
  });

  it("returns related keywords for 経理・財務", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("財務部");

    expect(category).toBe("経理・財務");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("財務部");
    expect(relatedKeywords).toContain("経理部");
  });

  it("returns その他 and original department as keyword for unknown departments", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("カスタマーサクセス部");

    expect(category).toBe("その他");
    expect(relatedKeywords).toEqual(["カスタマーサクセス部"]);
  });

  it("returns その他 and empty keywords for empty department name", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("   ");

    expect(category).toBe("その他");
    expect(relatedKeywords).toEqual([]);
  });
}
);
