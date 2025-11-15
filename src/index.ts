import "dotenv/config";
import { randomUUID } from "crypto";
import { mkdirSync, existsSync } from "fs";
import { z } from "zod";
import { createStructuredOutputs } from "./adapters/openai";
import { ContactListResponseSchema, ContactResponse } from "./domain/entities/contact";
import { Company } from "./domain/entities/company";
import {
  CompanySchema,
  CompanyRecord,
  ContactSchema,
  ContactRecord,
  EmailCandidateSchema,
  EmailCandidateRecord,
  EmailPatternRecordSchema,
  EmailPatternRecord,
} from "./domain";

const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const createContactSearchPrompt = (name: string, url: string, department: string) => {
  return `
あなたはB2B企業の担当者情報を調査するリサーチエージェントです。
以下の会社情報に基づいてWEB検索ツールを用い、サービスの導入事例や採用ページなど、
氏名・役職・部署が明示されている担当者情報を収集してください。

## 会社情報
- 会社名: ${name}
- 会社URL: ${url}
- 部署: ${department || "特に指定なし"}

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
   その部署と関連がありそうな人物（同じ部門名や、近い業務領域の役職）を優先的に抽出してください。

4. 以下のような人物は除外してください。
   - 就活生や応募者、インターン応募者など、従業員・役員ではない人物
   - 氏名だけで役職・部署が一切分からない人物
   - 個人のSNSアカウントや、企業と無関係な個人ブログ上の人物
   - 推測だけに基づく人物情報（確実にページ上に記載されていない情報）

5. 氏名の英字化について
   - 「姓」「名」は、氏名から推測されるローマ字表記を、
     すべて小文字のアルファベットで出力してください（例: 山田 太郎 → 姓: "yamada", 名: "taro"）。
   - ローマ字表記が明確に分からない場合は、一般的な日本人名のローマ字表記に基づいて自然に推測してください。

【出力項目】

担当者の情報として、1人あたり以下の項目を出力してください。

1. 氏名（半角スペース区切りの漢字など本名）
2. 役職
3. 部署
4. 姓（すべて小文字のアルファベット）
5. 名（すべて小文字のアルファベット）

【出力形式】

回答はJSON形式で、以下のスキーマに従ってください:
${ContactListResponseSchema.toString()}

制約:
- 回答には引用・参照・citationなどの情報を付与しないでください。
- JSON以外のテキスト（説明文や前置き、後書き）は出力しないでください。
`;
};

const EmailPatternSchema = z.object({
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
});

type EmailPattern = z.infer<typeof EmailPatternSchema>;

const createEmailPatternPrompt = (domain: string) => {
  return `
以下の会社ドメインについて、WEB検索を行い、実際に公開されているメールアドレスの例から、一般的に使われているメールアドレスの構成パターンを推定してください。

- ドメイン: ${domain}

以下のパターンの中から、最も一般的に使われていると考えられるものを1つだけ選んでください:
- "first.last"   : firstName.lastName@${domain}
- "last.first"   : lastName.firstName@${domain}
- "first-last"   : firstName-lastName@${domain}
- "last-first"   : lastName-firstName@${domain}
- "first_last"   : firstName_lastName@${domain}
- "last_first"   : lastName_firstName@${domain}
- "f.last"       : f.lastName@${domain} （fは名の頭文字）
- "f-last"       : f-lastName@${domain}
- "f_last"       : f_lastName@${domain}
- "flast"        : flastName@${domain}
- "firstlast"    : firstNamelastName@${domain}
- "lastfirst"    : lastNamefirstName@${domain}

回答はJSON形式で、以下のスキーマに従ってください:
${EmailPatternSchema.toString()}

注意点:
- 回答には引用・参照・citationなどの情報を付与しないでください
- patternフィールドには、上記の文字列のいずれか1つのみを出力してください
- reasonフィールドには、そのパターンを選択した理由を日本語で簡潔に説明してください
`;
};

// アルファベットとドメインからメールアドレスのパターンをリストで返す関数
function generateEmailCandidates(
  firstName: string,
  lastName: string,
  domain: string,
  primaryPattern?: EmailPattern["pattern"],
): string[] {
  const firstInitial = firstName[0];
  const candidatesWithPattern: { pattern: EmailPattern["pattern"]; email: string }[] = [
    { pattern: "first.last", email: `${firstName}.${lastName}@${domain}` },
    { pattern: "last.first", email: `${lastName}.${firstName}@${domain}` },
    { pattern: "first-last", email: `${firstName}-${lastName}@${domain}` },
    { pattern: "last-first", email: `${lastName}-${firstName}@${domain}` },
    { pattern: "first_last", email: `${firstName}_${lastName}@${domain}` },
    { pattern: "last_first", email: `${lastName}_${firstName}@${domain}` },
    { pattern: "f.last", email: `${firstInitial}.${lastName}@${domain}` },
    { pattern: "f-last", email: `${firstInitial}-${lastName}@${domain}` },
    { pattern: "f_last", email: `${firstInitial}_${lastName}@${domain}` },
  ];

  if (!primaryPattern) {
    return candidatesWithPattern.map((c) => c.email);
  }

  const sorted = candidatesWithPattern.sort((a, b) => {
    if (a.pattern === primaryPattern && b.pattern !== primaryPattern) return -1;
    if (b.pattern === primaryPattern && a.pattern !== primaryPattern) return 1;
    return 0;
  });

  return sorted.map((c) => c.email);
}

const ContactAndEmailCandidatesSchema = z.object({
  contact: z.object({
    name: z.string(),
    position: z.string(),
    department: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  emailCandidates: z.array(z.string()),
});

type ContactAndEmailCandidates = z.infer<typeof ContactAndEmailCandidatesSchema>;

type CliOptions = {
  company: Company;
  department: string;
  debug: boolean;
};

function parseCliArgs(): CliOptions {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const debug = args.includes("--debug");

  if (positional.length < 4) {
    console.error(
      "Usage: node dist/index.js <companyName> <companyUrl> <companyDomain> <department> [--debug]",
    );
    process.exit(1);
  }

  const [name, url, domain, department] = positional;

  const company: Company = {
    name,
    url,
    domain,
  };

  return {
    company,
    department,
    debug,
  };
}

async function saveAsCsvFiles(
  domain: string,
  companyRecords: CompanyRecord[],
  contactRecords: ContactRecord[],
  emailCandidateRecords: EmailCandidateRecord[],
  emailPatternRecords: EmailPatternRecord[],
): Promise<void> {
  console.log("👺 Save results to CSV files ...");

  const domainDirName = domain.replace(/\./g, "_");
  const baseDir = `outputs/${domainDirName}`;
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const companyCsvWriter = createCsvWriter({
    path: `${baseDir}/companies.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "name", title: "Name" },
      { id: "url", title: "URL" },
      { id: "domain", title: "Domain" },
    ],
  });

  const contactsCsvWriter = createCsvWriter({
    path: `${baseDir}/contacts.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "companyId", title: "Company ID" },
      { id: "name", title: "Name" },
      { id: "position", title: "Position" },
      { id: "department", title: "Department" },
      { id: "firstName", title: "First Name" },
      { id: "lastName", title: "Last Name" },
    ],
  });

  const emailCandidatesCsvWriter = createCsvWriter({
    path: `${baseDir}/email_candidates.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "contactId", title: "Contact ID" },
      { id: "email", title: "Email" },
    ],
  });

  const emailPatternsCsvWriter = createCsvWriter({
    path: `${baseDir}/email_patterns.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "companyId", title: "Company ID" },
      { id: "pattern", title: "Pattern" },
      { id: "reason", title: "Reason" },
    ],
  });

  await companyCsvWriter.writeRecords(companyRecords);
  await contactsCsvWriter.writeRecords(contactRecords);
  await emailCandidatesCsvWriter.writeRecords(emailCandidateRecords);
  await emailPatternsCsvWriter.writeRecords(emailPatternRecords);

  console.log("The CSV files were written successfully");
}

async function detectEmailPattern(
  domain: string,
): Promise<EmailPattern | null> {
  const prompt = createEmailPatternPrompt(domain);
  const result = await createStructuredOutputs(prompt, EmailPatternSchema, true);

  if (result.isErr()) {
    console.error("Error while detecting email pattern:", result.error);
    return null;
  }

  return result.value ?? null;
}

async function searchContacts(
  debug: boolean = false,
  name: string,
  url: string,
  department: string
): Promise<ContactResponse[]> {
  console.log("👺 Search Web to get contact info ...");
  if (debug) {
    return [
      {
        name: "松尾 庄馬",
        position: "取締役",
        department: "経営本部",
        firstName: "shoma",
        lastName: "matsuo",
      },
      {
        name: "山崎 祐太",
        position: "代表取締役",
        department: "経営本部",
        firstName: "yuta",
        lastName: "yamazaki",
      }
    ];
  }
  const contactSearchPrompt = createContactSearchPrompt(name, url, department);
  const result = await createStructuredOutputs(contactSearchPrompt, ContactListResponseSchema, true);
  if (result.isErr()) {
    console.error("Error:", result.error);
    process.exit(1);
  }
  return result.value.contacts;
}

function createContactAndEmailCandidates(
  contacts: ContactAndEmailCandidates["contact"][],
  domain: string,
  primaryPattern?: EmailPattern["pattern"],
): ContactAndEmailCandidates[] {
  return contacts.map((contact) => {
    const emailCandidates = generateEmailCandidates(
      contact.firstName,
      contact.lastName,
      domain,
      primaryPattern,
    );
    return {
      contact,
      emailCandidates,
    };
  });
}

async function main() {
  const { company, department, debug } = parseCliArgs();

  let detectedEmailPattern: EmailPattern | null = null;
  let emailPattern: EmailPattern["pattern"] | null = null;
  if (!debug) {
    console.log("👺 Detect email pattern by web search ...");
    detectedEmailPattern = await detectEmailPattern(company.domain);
    emailPattern = detectedEmailPattern?.pattern ?? null;
    console.log("Detected email pattern:", emailPattern);
    console.log(
      "Detected email pattern reason:",
      detectedEmailPattern?.reason ?? "理由が取得できませんでした",
    );
  }

  const contacts = await searchContacts(debug, company.name, company.url, department);
  console.log("Contacts:", JSON.stringify(contacts, null, 2));

  console.log("👺 Convert names to alphabet ...");

  // メールアドレス候補生成
  const candidates = createContactAndEmailCandidates(
    contacts,
    company.domain,
    emailPattern ?? undefined,
  );
  console.log("Contact and Email Candidates:", JSON.stringify(candidates, null, 2));

  // DB に保存するためのテーブル単位のデータに変換
  console.log("👺 Convert to DB table records ...");
  const companyId = randomUUID();

  const companyRecords: CompanyRecord[] = [
    CompanySchema.parse({
      id: companyId,
      name: company.name,
      url: company.url,
      domain: company.domain,
    }),
  ];

  const emailPatternRecords: EmailPatternRecord[] =
    !debug && detectedEmailPattern
      ? [
          EmailPatternRecordSchema.parse({
            id: randomUUID(),
            companyId,
            pattern: detectedEmailPattern.pattern,
            reason: detectedEmailPattern.reason,
          }),
        ]
      : [];

  const contactRecords: ContactRecord[] = contacts.map((contact) =>
    ContactSchema.parse({
      id: randomUUID(),
      companyId,
      name: contact.name,
      position: contact.position,
      department: contact.department,
      firstName: contact.firstName,
      lastName: contact.lastName,
    }),
  );

  const emailCandidateRecords: EmailCandidateRecord[] = (() => {
    const records: EmailCandidateRecord[] = [];
    contactRecords.forEach((contactRecord, index) => {
      const candidate = candidates[index];
      if (!candidate) return;
      candidate.emailCandidates.forEach((email) => {
        records.push(
          EmailCandidateSchema.parse({
            id: randomUUID(),
            contactId: contactRecord.id,
            email,
          }),
        );
      });
    });
    return records;
  })();

  await saveAsCsvFiles(
    company.domain,
    companyRecords,
    contactRecords,
    emailCandidateRecords,
    emailPatternRecords,
  );
}

main();
