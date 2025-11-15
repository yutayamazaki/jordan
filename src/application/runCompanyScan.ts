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
import { CliOptions } from "../cli/parseCliArgs";
import { z } from "zod";
import { ContactResponse } from "../domain/entities/contact";
import { ContactFinder, EmailPatternDetector, IdGenerator, LeadExporter } from "./ports";
import { generateEmailAddresses } from "./emailFinderService";

const DEFAULT_EMAIL_PATTERN: EmailPattern["pattern"] = "f-last";

const ContactAndEmailCandidatesSchema = z.object({
  contact: z.object({
    name: z.string(),
    position: z.string(),
    department: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }),
  primaryEmail: z.object({
    value: z.string(),
    confidence: z.number(),
  }),
  alternativeEmails: z.array(
    z.object({
      value: z.string(),
      confidence: z.number(),
    }),
  ),
});

type ContactAndEmailCandidates = z.infer<typeof ContactAndEmailCandidatesSchema>;

function createContactAndEmailCandidates(
  contacts: ContactResponse[],
  domain: string,
  primaryPattern?: EmailPattern["pattern"],
): ContactAndEmailCandidates[] {
  return contacts.map((contact) => {
    const emailCandidate = generateEmailAddresses({
      firstName: contact.firstName,
      lastName: contact.lastName,
      domain,
      primaryPattern,
    });
    return {
      contact,
      primaryEmail: {
        value: emailCandidate.primary.value,
        confidence: emailCandidate.primary.confidence,
      },
      alternativeEmails: emailCandidate.alternatives.map((alt) => ({
        value: alt.value,
        confidence: alt.confidence,
      })),
    };
  });
}

export type RunCompanyScanDependencies = {
  emailPatternDetector: EmailPatternDetector;
  contactFinder: ContactFinder;
  leadExporter: LeadExporter;
  idGenerator: IdGenerator;
};

export async function runCompanyScan(
  options: CliOptions,
  deps: RunCompanyScanDependencies,
): Promise<void> {
  const { company, department, debug } = options;

  let detectedEmailPattern: EmailPattern | null = null;
  let emailPattern: EmailPattern["pattern"] = DEFAULT_EMAIL_PATTERN;
  if (!debug) {
    console.log("\n👺 Detect email pattern by web search ...");
    detectedEmailPattern = await deps.emailPatternDetector.detect(company.domain);

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

  const contacts = await deps.contactFinder.searchContacts(
    debug,
    company.name,
    company.domain,
    department,
  );
  console.log("Contacts:", JSON.stringify(contacts, null, 2));

  console.log("\n👺 Convert names to alphabet ...");

  // メールアドレス候補生成
  const candidates = createContactAndEmailCandidates(contacts, company.domain, emailPattern);
  console.log("Contact and Email Candidates:", JSON.stringify(candidates, null, 2));

  // DB に保存するためのテーブル単位のデータに変換
  console.log("\n👺 Convert to DB table records ...");
  const companyId = deps.idGenerator.generate();

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
            id: deps.idGenerator.generate(),
            companyId,
            pattern: emailPattern,
            reason: detectedEmailPattern.reason,
          }),
        ]
      : [];

  const contactRecords: ContactRecord[] = contacts.map((contact) =>
    ContactSchema.parse({
      id: deps.idGenerator.generate(),
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

      // primary
      records.push(
        EmailCandidateSchema.parse({
          id: deps.idGenerator.generate(),
          contactId: contactRecord.id,
          email: candidate.primaryEmail.value,
          isPrimary: true,
          confidence: candidate.primaryEmail.confidence,
          type: "personal",
          pattern: emailPattern,
        }),
      );

      // alternatives
      candidate.alternativeEmails.forEach((alt) => {
        records.push(
          EmailCandidateSchema.parse({
            id: deps.idGenerator.generate(),
            contactId: contactRecord.id,
            email: alt.value,
            isPrimary: false,
            confidence: alt.confidence,
            type: "personal",
            pattern: emailPattern,
          }),
        );
      });
    });
    return records;
  })();

  await deps.leadExporter.export(
    company.domain,
    companyRecords,
    contactRecords,
    emailCandidateRecords,
    emailPatternRecords,
  );
}
