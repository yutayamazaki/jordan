import { EmailPattern } from "../domain/entities/emailPattern";
import { ContactResponse } from "../domain/entities/contact";
import {
  ContactFinder,
  EmailPatternDetector,
  EmailVerifier,
  EmailVerificationResult,
  IdGenerator,
  LeadExporter,
  EmailVerificationRepository,
} from "./ports";
import { EmailPatternRepository } from "./ports";
import {
  EmailPatternRecord,
  EmailPatternRecordSchema,
} from "../domain";
import {
  buildCompanyDomainEntities,
  createContactAndEmailCandidates,
  decideEmailPattern,
  ContactAndEmailCandidates,
  EmailPatternDecisionResult,
} from "./companyScanDomain";

export type RunCompanyScanDependencies = {
  emailPatternDetector: EmailPatternDetector;
  contactFinder: ContactFinder;
  emailVerifier: EmailVerifier;
  leadExporter: LeadExporter;
  idGenerator: IdGenerator;
  emailVerificationRepository: EmailVerificationRepository;
  emailPatternRepository: EmailPatternRepository;
};

export type CompanyScanOptions = {
  company: {
    name: string;
    domain: string;
  };
  department: string;
};

export type CompanyScanPhase = "collect" | "score" | "all";

export type CompanyScanRawData = {
  companyId: string;
  company: {
    name: string;
    domain: string;
  };
  department: string;
  patternDecision: EmailPatternDecisionResult;
  contacts: ContactResponse[];
  candidates: ContactAndEmailCandidates[];
};

export interface CompanyScanRawStore {
  save(raw: CompanyScanRawData): Promise<void>;
  load(
    domain: string,
    department: string,
  ): Promise<CompanyScanRawData | null>;
}

export type RunCompanyScanWithStoreDependencies = RunCompanyScanDependencies & {
  rawStore: CompanyScanRawStore;
};

export async function collectCompanyScan(
  options: CompanyScanOptions,
  deps: RunCompanyScanWithStoreDependencies,
): Promise<CompanyScanRawData> {
  const { company, department } = options;

  let detectedEmailPattern: EmailPattern | null = null;
  let emailPattern: EmailPattern["pattern"];
  console.log("\n👺 Detect email pattern by web search ...");
  detectedEmailPattern = await deps.emailPatternDetector.detect(company.domain);

  const companyId = deps.idGenerator.generate();

  const MAX_PATTERN_AGE_DAYS = 365;
  const learnedPatternRecord =
    await deps.emailPatternRepository.findRecentByDomain(
      company.domain,
      MAX_PATTERN_AGE_DAYS,
    );

  const patternDecision = decideEmailPattern(
    companyId,
    {
      detectedEmailPattern,
      learnedPattern: learnedPatternRecord
        ? {
            pattern: learnedPatternRecord.pattern,
            reason: learnedPatternRecord.reason,
          }
        : null,
    },
    deps.idGenerator,
  );
  emailPattern = patternDecision.pattern;

  patternDecision.logMessages.forEach((message) => console.log(message));

  const contacts = await deps.contactFinder.searchContacts(
    company.name,
    company.domain,
    department,
  );
  console.log("Contacts:", JSON.stringify(contacts, null, 2));

  console.log("\n👺 Convert names to alphabet ...");

  // メールアドレス候補生成
  const candidates = createContactAndEmailCandidates(contacts, company.domain, emailPattern);
  console.log("Contact and Email Candidates:", JSON.stringify(candidates, null, 2));

  const raw: CompanyScanRawData = {
    companyId,
    company,
    department,
    patternDecision,
    contacts,
    candidates,
  };

  await deps.rawStore.save(raw);

  return raw;
}

export async function scoreCompanyScan(
  raw: CompanyScanRawData,
  deps: Pick<
    RunCompanyScanDependencies,
    | "leadExporter"
    | "emailVerifier"
    | "emailVerificationRepository"
    | "emailPatternRepository"
    | "idGenerator"
  >,
): Promise<void> {
  console.log("\n👺 Convert to DB table records ...");

  console.log("\n👺 Verify email deliverability with EmailHippo ...");

  const allEmails = new Set<string>();
  raw.candidates.forEach((candidate) => {
    allEmails.add(candidate.primaryEmail.value);
    candidate.alternativeEmails.forEach((alt) => allEmails.add(alt.value));
  });

  const MAX_AGE_DAYS = 180;

  const emailVerificationEntries = await Promise.all(
    Array.from(allEmails).map(async (email) => {
      const cached = await deps.emailVerificationRepository.findRecent(
        email,
        MAX_AGE_DAYS,
      );
      if (cached) {
        console.log(
          `Using cached EmailHippo verification result (within ${MAX_AGE_DAYS} days):`,
          email,
        );
        return [email, cached] as const;
      }

      const fresh = await deps.emailVerifier.verify(email);
      const isHippoApiError =
        fresh.source === "email_hippo" &&
        fresh.reason?.startsWith("EmailHippo API call failed:");

      if (!isHippoApiError) {
        await deps.emailVerificationRepository.save(fresh);
      }
      return [email, fresh] as const;
    }),
  );

  const emailVerificationMap = new Map<string, EmailVerificationResult>(
    emailVerificationEntries.map(([email, result]) => [email, result]),
  );

  const {
    companyRecords,
    contactRecords,
    emailCandidateRecords,
  } = buildCompanyDomainEntities(
    raw.companyId,
    raw.company,
    raw.contacts,
    raw.candidates,
    raw.patternDecision.pattern,
    emailVerificationMap,
  );

  // EmailHippo の結果を元に EmailPattern を学習・更新
  const totalForPattern = emailCandidateRecords.filter(
    (r) => r.pattern === raw.patternDecision.pattern,
  ).length;
  const deliverableForPattern = emailCandidateRecords.filter(
    (r) =>
      r.pattern === raw.patternDecision.pattern && r.isDeliverable === true,
  );

  // 先に会社・担当者・メール候補を保存してからパターンを保存する
  await deps.leadExporter.export(
    raw.company.domain,
    companyRecords,
    contactRecords,
    emailCandidateRecords,
    raw.patternDecision.record,
  );

  if (totalForPattern > 0) {
    const sampleEmail = deliverableForPattern[0]?.email;
    const patternRecord: EmailPatternRecord = EmailPatternRecordSchema.parse({
      id: deps.idGenerator.generate(),
      companyId: raw.companyId,
      pattern: raw.patternDecision.pattern,
      reason: `Learned from EmailHippo results: ${deliverableForPattern.length}/${totalForPattern} deliverable`,
      domain: raw.company.domain,
      source: "email_hippo",
      sampleEmail,
      verifiedAt: new Date().toISOString(),
      successCount: deliverableForPattern.length,
      totalCount: totalForPattern,
    });

    await deps.emailPatternRepository.save(patternRecord);
  }
}

export async function scoreCompanyScanFromStored(
  options: CompanyScanOptions,
  deps: {
    rawStore: CompanyScanRawStore;
    leadExporter: LeadExporter;
    emailVerifier: EmailVerifier;
    emailVerificationRepository: EmailVerificationRepository;
    emailPatternRepository: EmailPatternRepository;
    idGenerator: IdGenerator;
  },
): Promise<void> {
  const { company, department } = options;

  console.log(
    `\n👺 Load stored scan data for ${company.domain} / ${department} ...`,
  );

  const raw = await deps.rawStore.load(company.domain, department);
  if (!raw) {
    console.log(
      "No stored scan data found. Please run with phase=collect or phase=all first.",
    );
    return;
  }

  await scoreCompanyScan(
    raw,
    {
      leadExporter: deps.leadExporter,
      emailVerifier: deps.emailVerifier,
      emailVerificationRepository: deps.emailVerificationRepository,
      emailPatternRepository: deps.emailPatternRepository,
      idGenerator: deps.idGenerator,
    },
  );
}

export async function runCompanyScan(
  options: CompanyScanOptions,
  deps: RunCompanyScanWithStoreDependencies,
  phase: CompanyScanPhase = "all",
): Promise<void> {
  if (phase === "collect") {
    await collectCompanyScan(options, deps);
    return;
  }

  if (phase === "score") {
    await scoreCompanyScanFromStored(
      options,
      {
        rawStore: deps.rawStore,
        leadExporter: deps.leadExporter,
        emailVerifier: deps.emailVerifier,
        emailVerificationRepository: deps.emailVerificationRepository,
        emailPatternRepository: deps.emailPatternRepository,
        idGenerator: deps.idGenerator,
      },
    );
    return;
  }

  const raw = await collectCompanyScan(options, deps);
  await scoreCompanyScan(
    raw,
    {
      leadExporter: deps.leadExporter,
      emailVerifier: deps.emailVerifier,
      emailVerificationRepository: deps.emailVerificationRepository,
      emailPatternRepository: deps.emailPatternRepository,
      idGenerator: deps.idGenerator,
    },
  );
}
