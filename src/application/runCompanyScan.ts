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
};

export type CompanyScanOptions = {
  company: {
    name: string;
    domain: string;
  };
  department: string;
  debug: boolean;
};

export type CompanyScanPhase = "collect" | "score" | "all";

export type CompanyScanRawData = {
  companyId: string;
  company: {
    name: string;
    domain: string;
  };
  department: string;
  debug: boolean;
  patternDecision: EmailPatternDecisionResult;
  contacts: ContactResponse[];
  candidates: ContactAndEmailCandidates[];
  emailVerificationResults: EmailVerificationResult[];
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
  const { company, department, debug } = options;

  let detectedEmailPattern: EmailPattern | null = null;
  let emailPattern: EmailPattern["pattern"];
  if (!debug) {
    console.log("\n👺 Detect email pattern by web search ...");
    detectedEmailPattern = await deps.emailPatternDetector.detect(company.domain);
  }

  const companyId = deps.idGenerator.generate();
  const patternDecision = decideEmailPattern(
    companyId,
    {
      debug,
      detectedEmailPattern,
    },
    deps.idGenerator,
  );
  emailPattern = patternDecision.pattern;

  patternDecision.logMessages.forEach((message) => console.log(message));

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

  // メールアドレス検証（MX レコードベースの簡易チェック）
  console.log("\n👺 Verify email deliverability (MX records) ...");
  const allEmails = new Set<string>();
  candidates.forEach((candidate) => {
    allEmails.add(candidate.primaryEmail.value);
    candidate.alternativeEmails.forEach((alt) => allEmails.add(alt.value));
  });

  const MAX_AGE_DAYS = 90;

  const emailVerificationEntries = await Promise.all(
    Array.from(allEmails).map(async (email) => {
      const cached = await deps.emailVerificationRepository.findRecent(
        email,
        MAX_AGE_DAYS,
      );
      if (cached) {
        console.log(
          `Using cached email verification result (within ${MAX_AGE_DAYS} days):`,
          email,
        );
        return [email, cached] as const;
      }

      const fresh = await deps.emailVerifier.verify(email);
      await deps.emailVerificationRepository.save(fresh);
      return [email, fresh] as const;
    }),
  );

  const emailVerificationResults: EmailVerificationResult[] = emailVerificationEntries.map(
    ([, result]) => result,
  );

  const raw: CompanyScanRawData = {
    companyId,
    company,
    department,
    debug,
    patternDecision,
    contacts,
    candidates,
    emailVerificationResults,
  };

  await deps.rawStore.save(raw);

  return raw;
}

export async function scoreCompanyScan(
  raw: CompanyScanRawData,
  deps: Pick<RunCompanyScanDependencies, "leadExporter">,
  emailVerificationOverrides?: Map<string, EmailVerificationResult>,
): Promise<void> {
  console.log("\n👺 Convert to DB table records ...");

  const emailVerificationMap = new Map<string, EmailVerificationResult>(
    raw.emailVerificationResults.map((result) => [result.email, result]),
  );

  if (emailVerificationOverrides) {
    for (const [email, override] of emailVerificationOverrides) {
      emailVerificationMap.set(email, override);
    }
  }

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

  await deps.leadExporter.export(
    raw.company.domain,
    companyRecords,
    contactRecords,
    emailCandidateRecords,
    raw.patternDecision.record,
  );
}

export async function scoreCompanyScanFromStored(
  options: CompanyScanOptions,
  deps: {
    rawStore: CompanyScanRawStore;
    leadExporter: LeadExporter;
  },
  emailVerificationOverrides?: Map<string, EmailVerificationResult>,
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
    { leadExporter: deps.leadExporter },
    emailVerificationOverrides,
  );
}

export async function runCompanyScan(
  options: CompanyScanOptions,
  deps: RunCompanyScanWithStoreDependencies,
  phase: CompanyScanPhase = "all",
  emailVerificationOverrides?: Map<string, EmailVerificationResult>,
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
      },
      emailVerificationOverrides,
    );
    return;
  }

  const raw = await collectCompanyScan(options, deps);
  await scoreCompanyScan(
    raw,
    { leadExporter: deps.leadExporter },
    emailVerificationOverrides,
  );
}
