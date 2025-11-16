import { describe, it, expect } from "vitest";
import {
  classifyDepartmentName,
  getDepartmentCategorySearchInfo,
} from "./departmentClassifier";

describe("classifyDepartmentName", () => {
  it("classifies IT / DX related departments as IT_SYSTEMS_DX", () => {
    expect(classifyDepartmentName("情報システム部")).toBe("IT_SYSTEMS_DX");
    expect(classifyDepartmentName("情シス")).toBe("IT_SYSTEMS_DX");
    expect(classifyDepartmentName("DX推進部")).toBe("IT_SYSTEMS_DX");
    expect(classifyDepartmentName("テクノロジー本部")).toBe("IT_SYSTEMS_DX");
    expect(classifyDepartmentName("社内 IT")).toBe("IT_SYSTEMS_DX");
  });

  it("classifies sales departments as SALES", () => {
    expect(classifyDepartmentName("営業部")).toBe("SALES");
    expect(classifyDepartmentName("インサイドセールス")).toBe("SALES");
    expect(classifyDepartmentName("フィールドセールス")).toBe("SALES");
    expect(classifyDepartmentName("法人営業部")).toBe("SALES");
  });

  it("classifies marketing departments as MARKETING", () => {
    expect(classifyDepartmentName("マーケティング部")).toBe("MARKETING");
    expect(classifyDepartmentName("マーケ部")).toBe("MARKETING");
    expect(classifyDepartmentName("プロモーション部")).toBe("MARKETING");
    expect(classifyDepartmentName("広報部")).toBe("MARKETING");
  });

  it("classifies HR departments as HR", () => {
    expect(classifyDepartmentName("人事部")).toBe("HR");
    expect(classifyDepartmentName("人材開発部")).toBe("HR");
    expect(classifyDepartmentName("組織開発部")).toBe("HR");
    expect(classifyDepartmentName("採用部")).toBe("HR");
  });

  it("classifies finance related departments as FINANCE", () => {
    expect(classifyDepartmentName("財務部")).toBe("FINANCE");
    expect(classifyDepartmentName("経理部")).toBe("FINANCE");
    expect(classifyDepartmentName("ファイナンス部")).toBe("FINANCE");
    expect(classifyDepartmentName("経営管理部")).toBe("FINANCE");
  });

  it("returns OTHER for empty or unknown department names", () => {
    expect(classifyDepartmentName("")).toBe("OTHER");
    expect(classifyDepartmentName("   ")).toBe("OTHER");
    expect(classifyDepartmentName("カスタマーサクセス部")).toBe("OTHER");
  });
});

describe("getDepartmentCategorySearchInfo", () => {
  it("returns related keywords for IT_SYSTEMS_DX", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("情報システム部");

    expect(category).toBe("IT_SYSTEMS_DX");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("情報システム部");
    expect(relatedKeywords).toContain("DX推進部");
    expect(relatedKeywords).toContain("テクノロジー本部");
  });

  it("returns related keywords for SALES", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("営業部");

    expect(category).toBe("SALES");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("営業部");
    expect(relatedKeywords).toContain("法人営業部");
    expect(relatedKeywords).toContain("インサイドセールス");
  });

  it("returns related keywords for MARKETING", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("マーケティング部");

    expect(category).toBe("MARKETING");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("マーケティング部");
    expect(relatedKeywords).toContain("プロモーション部");
    expect(relatedKeywords).toContain("広報部");
  });

  it("returns related keywords for HR", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("人事部");

    expect(category).toBe("HR");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("人事部");
    expect(relatedKeywords).toContain("人材開発部");
  });

  it("returns related keywords for FINANCE", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("財務部");

    expect(category).toBe("FINANCE");
    expect(relatedKeywords.length).toBeGreaterThan(0);
    expect(relatedKeywords).toContain("財務部");
    expect(relatedKeywords).toContain("経理部");
  });

  it("returns OTHER and original department as keyword for unknown departments", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("カスタマーサクセス部");

    expect(category).toBe("OTHER");
    expect(relatedKeywords).toEqual(["カスタマーサクセス部"]);
  });

  it("returns OTHER and empty keywords for empty department name", () => {
    const { category, relatedKeywords } =
      getDepartmentCategorySearchInfo("   ");

    expect(category).toBe("OTHER");
    expect(relatedKeywords).toEqual([]);
  });
}
);

