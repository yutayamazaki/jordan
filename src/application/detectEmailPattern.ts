import { createStructuredOutputs } from "../adapters/openai";
import { EmailPattern, EmailPatternSchema } from "../domain/entities/emailPattern";

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

上記のような公開メールアドレスの例が見つからない、あるいは明確なパターンを特定できない場合は、
「パターンを特定できなかった」という事実をデータとして表現してください。
その場合、pattern には一般的なデフォルトパターンとして "f-last" を設定し、
found フィールドを false にしてください。

回答はJSON形式で、以下のスキーマに従ってください:
${EmailPatternSchema.toString()}

注意点:
- 回答には引用・参照・citationなどの情報を付与しないでください
- patternフィールドには、上記の文字列のいずれか1つのみを出力してください
- reasonフィールドには、そのパターンを選択した理由、もしくはパターンを特定できなかった場合はその理由とデフォルトパターンを利用する旨を日本語で簡潔に説明してください
`;
};

export async function detectEmailPattern(domain: string): Promise<EmailPattern | null> {
  const prompt = createEmailPatternPrompt(domain);
  const result = await createStructuredOutputs(prompt, EmailPatternSchema, true);

  if (result.isErr()) {
    throw result.error;
  }

  return result.value ?? null;
}
