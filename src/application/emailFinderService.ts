import { EmailPattern } from "../domain/entities/emailPattern";
import {
  EmailAddress,
  EmailCandidate,
  EmailType,
} from "../domain/entities/emailAddress";

const DEFAULT_EMAIL_PATTERN: EmailPattern["pattern"] = "f-last";

type EmailFinderInput = {
  firstName: string;
  lastName: string;
  domain: string;
  primaryPattern?: EmailPattern["pattern"];
};

export function generateEmailAddresses({
  firstName,
  lastName,
  domain,
  primaryPattern,
}: EmailFinderInput): EmailCandidate {
  const firstInitial = firstName[0];

  const entries: { pattern: EmailPattern["pattern"]; local: string }[] = [
    { pattern: "last", local: `${lastName}` },
    { pattern: "first.last", local: `${firstName}.${lastName}` },
    { pattern: "last.first", local: `${lastName}.${firstName}` },
    { pattern: "first-last", local: `${firstName}-${lastName}` },
    { pattern: "last-first", local: `${lastName}-${firstName}` },
    { pattern: "first_last", local: `${firstName}_${lastName}` },
    { pattern: "last_first", local: `${lastName}_${firstName}` },
    { pattern: "firstlast", local: `${firstName}${lastName}` },
    { pattern: "lastfirst", local: `${lastName}${firstName}` },
    { pattern: "f.last", local: `${firstInitial}.${lastName}` },
    { pattern: "f-last", local: `${firstInitial}-${lastName}` },
    { pattern: "f_last", local: `${firstInitial}_${lastName}` },
    { pattern: "flast", local: `${firstInitial}${lastName}` },
  ];

  const selectedPattern: EmailPattern["pattern"] = primaryPattern ?? DEFAULT_EMAIL_PATTERN;

  const emails: EmailAddress[] = entries.map((entry) => {
    const value = `${entry.local}@${domain}`;
    const type: EmailType = "personal";

    return {
      value,
      type,
      pattern: entry.pattern,
      sources: [],
    };
  });

  const primary =
    emails.find((email) => email.pattern === selectedPattern) ?? emails[0];

  const alternatives = emails.filter((email) => email.value !== primary.value);

  return {
    primary,
    alternatives,
    // 現状は LLM など外部ソースを参照していないため空配列。
    // 将来的にクローラや LLM で実際の取得元ページを追跡する場合に利用する。
    sources: [],
  };
}
