import { createStructuredOutputs } from "../adapters/openai";
import { EmailPattern, EmailPatternSchema } from "../domain/entities/emailPattern";

const createEmailPatternPrompt = (domain: string) => {
  return `
以下の会社ドメインについて、WEB検索を行い、実際に公開されているメールアドレスの例から、一般的に使われているメールアドレスの構成パターンを推定してください。
その際、「どのような検索クエリで検索すればメールアドレスに到達しやすいか」を意識して、効果的な検索クエリを自分で設計してから検索を行ってください。
さらに、パターン推定の根拠となる「情報ソース（どのURL・どのページタイトルのサイトから得たか）」も一緒に構造化して出力してください。

- ドメイン: ${domain}

## 検索クエリ設計のヒント

メールアドレスが見つかりやすいページや文脈を狙って、以下のような検索クエリを組み合わせて活用してください。

- 公式サイト内のメール表記を探すクエリ
  - \`"${domain}" "@${domain}"\`
  - \`"@${domain}" site:${domain}\`
  - \`"contact@${domain}" OR "info@${domain}" OR "support@${domain}"\`
- お問い合わせ・会社情報ページを狙うクエリ
  - \`"${domain}" "お問い合わせ" "@"\`
  - \`"${domain}" "contact" "@"\`
  - \`"${domain}" "会社情報" "@"\`
- 採用・メンバー紹介ページを狙うクエリ
  - \`"${domain}" "採用" "@"\`
  - \`"${domain}" "メンバー紹介" "@"\`
  - \`"${domain}" "recruit" "@"\`
- 英語表記の連絡先を狙うクエリ
  - \`"${domain}" "email" "@"\`
  - \`"${domain}" "contact us" "@"\`
  - \`"${domain}" "get in touch" "@"\`

これらをベースに、「サイト内検索（site:）」や会社名・サービス名との組み合わせなど、必要に応じてクエリを工夫して構いません。
重要なのは、実際のメールアドレス文字列（"@${domain}" を含む文字列）にたどり着くようなクエリ設計を行うことです。

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
${EmailPatternSchema.toString()}

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
    reasoningEffort: "minimal",
    model: "gpt-5-mini-2025-08-07",
  });

  if (result.isErr()) {
    throw result.error;
  }

  return result.value ?? null;
}
