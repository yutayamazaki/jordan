import { randomUUID } from "crypto";
import {
  CompanySchema,
  CompanyRecord,
  ContactSchema,
  ContactRecord,
  EmailCandidateSchema,
  EmailCandidateRecord,
  EmailPatternRecordSchema,
  EmailPatternRecord,
} from "../domain";
import { EmailPattern } from "../domain/entities/emailPattern";
import { detectEmailPattern } from "./detectEmailPattern";
import { searchContacts } from "./searchContacts";
import { saveAsCsvFiles } from "../infrastructure/saveAsCsvFiles";
import { CliOptions } from "../cli/parseCliArgs";
import { z } from "zod";

const DEFAULT_EMAIL_PATTERN: EmailPattern["pattern"] = "f-last";

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
    { pattern: "firstlast", email: `${firstName}${lastName}@${domain}` },
    { pattern: "lastfirst", email: `${lastName}${firstName}@${domain}` },
    { pattern: "f.last", email: `${firstInitial}.${lastName}@${domain}` },
    { pattern: "f-last", email: `${firstInitial}-${lastName}@${domain}` },
    { pattern: "f_last", email: `${firstInitial}_${lastName}@${domain}` },
    { pattern: "flast", email: `${firstInitial}${lastName}@${domain}` },
  ];

  const patternToUse: EmailPattern["pattern"] = primaryPattern ?? "f-last";
  const selected =
    candidatesWithPattern.find((c) => c.pattern === patternToUse) ??
    candidatesWithPattern[0];

  return [selected.email];
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

export async function runCompanyScan(options: CliOptions): Promise<void> {
  const { company, department, debug } = options;

  let detectedEmailPattern: EmailPattern | null = null;
  let emailPattern: EmailPattern["pattern"] = DEFAULT_EMAIL_PATTERN;
  if (!debug) {
    console.log("👺 Detect email pattern by web search ...");
    detectedEmailPattern = await detectEmailPattern(company.domain);

    if (detectedEmailPattern?.found) {
      emailPattern = detectedEmailPattern.pattern;
      console.log("Detected email pattern:", emailPattern);
      console.log("Detected email pattern reason:", detectedEmailPattern.reason);
    } else {
      emailPattern = DEFAULT_EMAIL_PATTERN;
      console.log(
        "Email pattern could not be determined from web search. Using default pattern:",
        emailPattern,
      );
      console.log(
        "Email pattern detection reason:",
        detectedEmailPattern?.reason ?? "理由が取得できませんでした",
      );
    }
  } else {
    emailPattern = DEFAULT_EMAIL_PATTERN;
  }

  const contacts = await searchContacts(debug, company.name, company.domain, department);
  console.log("Contacts:", JSON.stringify(contacts, null, 2));

  console.log("👺 Convert names to alphabet ...");

  // メールアドレス候補生成
  const candidates = createContactAndEmailCandidates(contacts, company.domain, emailPattern);
  console.log("Contact and Email Candidates:", JSON.stringify(candidates, null, 2));

  // DB に保存するためのテーブル単位のデータに変換
  console.log("👺 Convert to DB table records ...");
  const companyId = randomUUID();

  const companyRecords: CompanyRecord[] = [
    CompanySchema.parse({
      id: companyId,
      name: company.name,
      domain: company.domain,
    }),
  ];

  const emailPatternRecords: EmailPatternRecord[] =
    !debug && detectedEmailPattern
      ? [
          EmailPatternRecordSchema.parse({
            id: randomUUID(),
            companyId,
            pattern: emailPattern,
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
