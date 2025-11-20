import { createStructuredOutputs } from "../adapters/openai";
import { EmailPattern, EmailPatternSchema } from "../domain/entities/emailPattern";

const createEmailPatternPrompt = (domain: string) => {
  return `あなたは企業のメールアドレスパターンを分析する専門家です。

タスク: ${domain} で使用されているメールアドレスの構成パターンを特定してください。

手順:
1. 効果的な検索クエリを設計し、実際のメールアドレス例を探す
2. 見つかった例から最も一般的なパターンを1つ特定する
3. パターンの根拠となった情報源を記録する

検索戦略のヒント:
- 公式サイトの連絡先ページ: "@${domain}" site:${domain}
- お問い合わせ・採用ページ: "${domain}" "contact" OR "採用" "@"
- 特定の共通アドレス: "info@${domain}" OR "support@${domain}"

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

上記のような公開メールアドレスの例が見つからない、あるいは明確なパターンを特定できない場合は、
「パターンを特定できなかった」という事実をデータとして表現してください。
その場合、pattern には一般的なデフォルトパターンとして "f-last" を設定し、
found フィールドを false にしてください。

sources フィールドには、検索を行ったが有効なメールアドレスが見つからなかったことが分かるページ（会社情報ページやお問い合わせページなど）があれば、そのURLとページタイトルを含めてください。

回答はJSON形式で、以下のスキーマに従ってください:

{
  "pattern": string // 以下のいずれか: "last", "first.last", "last.first", "first-last", "last-first", "first_last", "last_first", "firstlast", "lastfirst", "f.last", "f-last", "f_last", "flast",
  "reason": string, // そのパターンを選択した理由や、パターンを特定できなかった場合の説明
  "found": boolean, // 実際の公開メールからパターンを特定できた場合は true、特定できずデフォルトパターンを利用する場合は false,
  "sources": [      // パターン推定に利用したページ情報の配列
    {
      "url": string | null,       // 参照したページのURL
      "pageTitle": string | null  // 参照したページのタイトル
    }
  ]
}

注意点:
- 回答には引用・参照・citationなどの情報を付与しないでください
- patternフィールドには、上記の文字列のいずれか1つのみを出力してください
- reasonフィールドには、そのパターンを選択した理由、もしくはパターンを特定できなかった場合はその理由とデフォルトパターンを利用する旨を日本語で簡潔に説明してください
- sourcesフィールドには、パターン推定に利用した主なページのURLとページタイトルを含めてください（複数可）
`;
};

export async function detectEmailPattern(domain: string): Promise<EmailPattern | null> {
  const prompt = createEmailPatternPrompt(domain);
  const result = await createStructuredOutputs(prompt, EmailPatternSchema, {
    useWebSearch: true,
    reasoningEffort: "low",
    model: "gpt-5-mini-2025-08-07",
  });

  if (result.isErr()) {
    throw result.error;
  }

  return result.value ?? null;
}
