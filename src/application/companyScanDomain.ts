import { z } from "zod";
import {
  CompanyRecord,
  CompanySchema,
  ContactRecord,
  ContactSchema,
  EmailCandidateRecord,
  EmailCandidateSchema,
  EmailPatternRecord,
  EmailPatternRecordSchema,
} from "../domain";
import { EmailPattern } from "../domain/entities/emailPattern";
import { ContactResponse } from "../domain/entities/contact";
import { EmailVerificationResult, IdGenerator } from "./ports";
import { generateEmailAddresses } from "./emailFinderService";
import { classifyDepartmentName } from "./departmentClassifier";

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

export type ContactAndEmailCandidates = z.infer<
  typeof ContactAndEmailCandidatesSchema
>;

export type EmailPatternDecisionInput = {
  detectedEmailPattern: EmailPattern | null;
  learnedPattern?: {
    pattern: EmailPattern["pattern"];
    reason: string;
  } | null;
};

export type EmailPatternDecisionResult = {
  pattern: EmailPattern["pattern"];
  record: EmailPatternRecord[]; // empty when no record should be stored
  logMessages: string[];
};

export function decideEmailPattern(
  companyId: string,
  input: EmailPatternDecisionInput,
  idGenerator: IdGenerator,
): EmailPatternDecisionResult {
  const { detectedEmailPattern, learnedPattern } = input;

  if (learnedPattern) {
    const pattern = learnedPattern.pattern;
    const record: EmailPatternRecord[] = [
      EmailPatternRecordSchema.parse({
        id: idGenerator.generate(),
        companyId,
        pattern,
        reason: learnedPattern.reason,
      }),
    ];

    return {
      pattern,
      record,
      logMessages: [
        "Using learned email pattern from past results:",
        pattern,
        "Learned email pattern reason:",
        learnedPattern.reason,
      ],
    };
  }

  if (detectedEmailPattern && detectedEmailPattern.found) {
    const pattern = detectedEmailPattern.pattern;
    const record: EmailPatternRecord[] = [
      EmailPatternRecordSchema.parse({
        id: idGenerator.generate(),
        companyId,
        pattern,
        reason: detectedEmailPattern.reason,
      }),
    ];

    return {
      pattern,
      record,
      logMessages: [
        "Detected email pattern:",
        pattern,
        "Detected email pattern reason:",
        detectedEmailPattern.reason,
      ],
    };
  }

  return {
    pattern: DEFAULT_EMAIL_PATTERN,
    record: [],
    logMessages: [
      "Email pattern could not be determined from web search. Using default pattern:",
      DEFAULT_EMAIL_PATTERN,
      "Email pattern detection reason:",
      detectedEmailPattern?.reason ?? "理由が取得できませんでした",
    ],
  };
}

export function createContactAndEmailCandidates(
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

export function adjustEmailConfidence(
  baseConfidence: number,
  verification?: EmailVerificationResult,
): number {
  if (!verification) return baseConfidence;

  if (verification.source === "email_hippo") {
    if (verification.isDeliverable === true) {
      return 1;
    }
    if (verification.isDeliverable === false) {
      return Math.min(baseConfidence, 0.1);
    }
  }

  let adjusted = baseConfidence;
  if (verification.hasMxRecords) {
    adjusted = Math.min(1, adjusted + 0.1);
  } else {
    adjusted = Math.max(0, adjusted - 0.3);
  }
  return adjusted;
}

export type CompanyDomainEntities = {
  companyRecords: CompanyRecord[];
  contactRecords: ContactRecord[];
  emailCandidateRecords: EmailCandidateRecord[];
  emailPatternRecords: EmailPatternRecord[];
};

export function buildCompanyDomainEntities(
  companyId: string,
  company: { name: string; domain: string },
  contacts: ContactResponse[],
  candidates: ContactAndEmailCandidates[],
  emailPattern: EmailPattern["pattern"],
  emailVerificationMap: Map<string, EmailVerificationResult>,
): CompanyDomainEntities {
  const companyRecords: CompanyRecord[] = [
    CompanySchema.parse({
      id: companyId,
      name: company.name,
      domain: company.domain,
    }),
  ];

  const contactRecords: ContactRecord[] = contacts.map((contact) =>
    ContactSchema.parse({
      id: crypto.randomUUID(),
      companyId,
      name: contact.name,
      position: contact.position,
      department: contact.department,
      departmentCategory: classifyDepartmentName(contact.department),
      firstName: contact.firstName,
      lastName: contact.lastName,
    }),
  );

  const emailCandidateRecords: EmailCandidateRecord[] = (() => {
    const records: EmailCandidateRecord[] = [];
    contactRecords.forEach((contactRecord, index) => {
      const candidate = candidates[index];
      if (!candidate) return;

      records.push(
        EmailCandidateSchema.parse({
          id: crypto.randomUUID(),
          contactId: contactRecord.id,
          email: candidate.primaryEmail.value,
          isPrimary: true,
          confidence: adjustEmailConfidence(
            candidate.primaryEmail.confidence,
            emailVerificationMap.get(candidate.primaryEmail.value),
          ),
          type: "personal",
          pattern: emailPattern,
          isDeliverable: emailVerificationMap.get(candidate.primaryEmail.value)?.isDeliverable,
          hasMxRecords: emailVerificationMap.get(candidate.primaryEmail.value)?.hasMxRecords,
          verificationReason: emailVerificationMap.get(candidate.primaryEmail.value)?.reason,
        }),
      );

      candidate.alternativeEmails.forEach((alt) => {
        records.push(
          EmailCandidateSchema.parse({
            id: crypto.randomUUID(),
            contactId: contactRecord.id,
            email: alt.value,
            isPrimary: false,
            confidence: adjustEmailConfidence(
              alt.confidence,
              emailVerificationMap.get(alt.value),
            ),
            type: "personal",
            pattern: emailPattern,
            isDeliverable: emailVerificationMap.get(alt.value)?.isDeliverable,
            hasMxRecords: emailVerificationMap.get(alt.value)?.hasMxRecords,
            verificationReason: emailVerificationMap.get(alt.value)?.reason,
          }),
        );
      });
    });
    return records;
  })();

  return {
    companyRecords,
    contactRecords,
    emailCandidateRecords,
    emailPatternRecords: [],
  };
}
