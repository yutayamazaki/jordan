import { createStructuredOutputs } from "../adapters/openai";
import { ContactListResponseSchema, ContactResponse } from "../domain/entities/contact";
import { getDepartmentCategorySearchInfo } from "./departmentClassifier";

const createContactSearchPrompt = (name: string, domain: string, department: string) => {
  const trimmedDepartment = department.trim();
  const categoryInfo = trimmedDepartment
    ? getDepartmentCategorySearchInfo(trimmedDepartment)
    : { category: "OTHER" as const, relatedKeywords: [] };

  const departmentDescription = trimmedDepartment || "特に指定なし";
  const categoryDescription =
    trimmedDepartment && categoryInfo.relatedKeywords.length > 0
      ? `
部署指定について:
- ユーザー指定部署名: ${trimmedDepartment}
- 部署カテゴリ: ${categoryInfo.category}
- 類似部署キーワードの例: ${categoryInfo.relatedKeywords.join(" / ")}

上記の部署カテゴリに属すると考えられる部署（例: ${categoryInfo.relatedKeywords.join(
        "、",
      )} など）の担当者も、同じカテゴリの候補として積極的に抽出してください。
`
      : "";

  return `
あなたはB2B企業の担当者情報を調査するリサーチエージェントです。
以下の会社情報に基づいてWEB検索ツールを用い、サービスの導入事例や採用ページなど、
氏名・役職・部署が明示されている担当者情報を収集してください。
その際、各担当者情報がどのページから得られたか（URLとページタイトル）も一緒に特定し、構造化して出力してください。

## 会社情報
- 会社名: ${name}
- 会社ドメイン: ${domain}
- 部署: ${departmentDescription}
${categoryDescription}

## 調査方針

1. WEB検索では、会社名と以下のようなキーワードを組み合わせて検索し、
   氏名・役職・部署が載っていそうなページを優先的に調査してください。

   - サービス事例・導入事例ページ
     - 例: 「導入事例」「お客様事例」「事例インタビュー」「case study」
   - 採用・リクルート関連ページ
     - 例: 「採用サイト」「社員インタビュー」「メンバー紹介」「先輩インタビュー」
   - 会社情報・組織系ページ
     - 例: 「会社情報」「役員紹介」「組織図」「management team」
   - IR・プレス・ニュース
     - 例: 「プレスリリース」「ニュース」「IR」「コーポレートガバナンス」
   - セミナー・イベント・登壇情報
     - 例: 「セミナー」「ウェビナー」「イベント」「登壇者」
   - オウンドメディア・ブログ
     - 例: 「ブログ」「オウンドメディア」「note」「技術ブログ」
   - パートナー・アライアンス紹介ページ
     - 例: 「パートナー」「アライアンス」「提携」

2. 特に、以下の条件を満たす人物を「担当者候補」として抽出してください。
   - 氏名（フルネーム）が記載されている
   - 役職または部署名が一緒に記載されている
   - 当該企業の従業員・役員など、法人の公式な立場を持つ人物である
   - 顧客企業側の担当者が事例インタビュー等に記載されている場合も候補に含めてよい

3. 部署指定がある場合（上記の「部署」情報が空でない場合）は、
   その部署と関連がありそうな人物（同じ部門名や、近い業務領域の役職）や、
   上記の「部署カテゴリ」に含まれると考えられる部署名を持つ人物を優先的に抽出してください。

4. 以下のような人物は除外してください。
   - 就活生や応募者、インターン応募者など、従業員・役員ではない人物
   - 氏名だけで役職・部署が一切分からない人物
   - 個人のSNSアカウントや、企業と無関係な個人ブログ上の人物
   - 推測だけに基づく人物情報（確実にページ上に記載されていない情報）

5. 氏名の英字化について
   - 「名（firstName）」「姓（lastName）」は、氏名から推測されるローマ字表記を、
     すべて小文字のアルファベットで出力してください（例: 山田 太郎 → firstName: "taro", lastName: "yamada"）。
   - ローマ字表記が明確に分からない場合は、一般的な日本人名のローマ字表記に基づいて自然に推測してください。

【出力項目】

担当者の情報として、1人あたり以下の項目を出力してください。

1. 氏名（半角スペース区切りの漢字など本名）
2. 役職
3. 部署
4. 名（firstName, すべて小文字のアルファベット）
5. 姓（lastName, すべて小文字のアルファベット）
6. 情報ソース（sources）
   - その担当者情報が記載されていたページの URL（url）
   - そのページのタイトル（pageTitle）
   - 複数のページから確認できた場合は、sources配列に複数要素を含めてください

【出力形式】

回答はJSON形式で、以下のスキーマに従ってください:
${ContactListResponseSchema.toString()}

制約:
- 回答には引用・参照・citationなどの情報を付与しないでください。
- JSON以外のテキスト（説明文や前置き、後書き）は出力しないでください。
- sources には、実際に担当者情報が確認できたページのみを含めてください。
`;
};

export async function searchContacts(
  debug: boolean = false,
  name: string,
  domain: string,
  department: string,
): Promise<ContactResponse[]> {
  console.log("\n👺 Search Web to get contact info ...");
  if (debug) {
    return [
      {
        name: "松尾 庄馬",
        position: "取締役",
        department: "経営本部",
        firstName: "shoma",
        lastName: "matsuo",
        sources: [],
      },
      {
        name: "山崎 祐太",
        position: "代表取締役",
        department: "経営本部",
        firstName: "yuta",
        lastName: "yamazaki",
        sources: [],
      },
    ];
  }
  const contactSearchPrompt = createContactSearchPrompt(name, domain, department);
  const result = await createStructuredOutputs(
    contactSearchPrompt,
    ContactListResponseSchema,
    true,
  );
  if (result.isErr()) {
    throw result.error;
  }
  return result.value.contacts;
}
