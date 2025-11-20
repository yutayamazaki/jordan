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
import { err, ok, Result } from "neverthrow";

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

async function verifyEmails(
  emails: Set<string>,
  deps: Pick<
    RunCompanyScanDependencies,
    "emailVerifier" | "emailVerificationRepository"
  >,
  maxAgeDays: number,
): Promise<Result<Map<string, EmailVerificationResult>, Error>> {
  try {
    const emailVerificationEntries = await Promise.all(
      Array.from(emails).map(async (email) => {
        const cached = await deps.emailVerificationRepository.findRecent(
          email,
          maxAgeDays,
        );
        if (cached) {
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

    return ok(
      new Map<string, EmailVerificationResult>(
        emailVerificationEntries.map(([email, result]) => [email, result]),
      ),
    );
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function collectCompanyScan(
  options: CompanyScanOptions,
  deps: RunCompanyScanWithStoreDependencies,
): Promise<Result<CompanyScanRawData, Error>> {
  try {
    const { company, department } = options;

    const companyId = deps.idGenerator.generate();

    const MAX_PATTERN_AGE_DAYS = 365;
    const learnedPatternRecord =
      await deps.emailPatternRepository.findRecentByDomain(
        company.domain,
        MAX_PATTERN_AGE_DAYS,
      );

    let detectedEmailPattern: EmailPattern | null = null;

    if (learnedPatternRecord) {
      console.log(
        "\nUse learned email pattern from repository (skip web detection) ...",
      );
    } else {
      const detectedEmailPatternResult = await deps.emailPatternDetector.detect(
        company.domain,
      );
      if (detectedEmailPatternResult.isErr()) {
        return err(detectedEmailPatternResult.error);
      }
      detectedEmailPattern = detectedEmailPatternResult.value;
    }

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

    const contactsResult = await deps.contactFinder.searchContacts(
      company.name,
      company.domain,
      department,
    );

    if (contactsResult.isErr()) {
      return err(contactsResult.error);
    }

    const raw: CompanyScanRawData = {
      companyId,
      company,
      department,
      patternDecision,
      contacts: contactsResult.value,
    };

    await deps.rawStore.save(raw);

    return ok(raw);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
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
): Promise<Result<void, Error>> {
  try {
    const candidates: ContactAndEmailCandidates[] =
      createContactAndEmailCandidates(
        raw.contacts,
        raw.company.domain,
        raw.patternDecision.pattern,
      );

    const MAX_AGE_DAYS = 180;

    const primaryEmails = new Set<string>();
    const alternativeEmails = new Set<string>();
    candidates.forEach((candidate) => {
      primaryEmails.add(candidate.primaryEmail.value);
      candidate.alternativeEmails.forEach((alt) => {
        alternativeEmails.add(alt.value);
      });
    });

    const primaryVerificationMapResult = await verifyEmails(
      primaryEmails,
      deps,
      MAX_AGE_DAYS,
    );

    if (primaryVerificationMapResult.isErr()) {
      return err(primaryVerificationMapResult.error);
    }

    const primaryVerificationMap = primaryVerificationMapResult.value;

    const hasDeliverablePrimary = candidates.some((candidate) => {
      const verification = primaryVerificationMap.get(
        candidate.primaryEmail.value,
      );
      return verification?.isDeliverable === true;
    });

    let emailVerificationMap: Map<string, EmailVerificationResult>;

    if (hasDeliverablePrimary) {
      emailVerificationMap = primaryVerificationMap;
    } else {
      const remainingAlternativeEmails = new Set<string>();
      alternativeEmails.forEach((email) => {
        if (!primaryVerificationMap.has(email)) {
          remainingAlternativeEmails.add(email);
        }
      });

      const alternativeVerificationMapResult = await verifyEmails(
        remainingAlternativeEmails,
        deps,
        MAX_AGE_DAYS,
      );

      if (alternativeVerificationMapResult.isErr()) {
        return err(alternativeVerificationMapResult.error);
      }

      emailVerificationMap = new Map<string, EmailVerificationResult>([
        ...primaryVerificationMap,
        ...alternativeVerificationMapResult.value,
      ]);
    }

    const {
      companyRecords,
      contactRecords,
      emailCandidateRecords,
    } = buildCompanyDomainEntities(
      raw.companyId,
      raw.company,
      raw.contacts,
      candidates,
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

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
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
): Promise<Result<void, Error>> {
  try {
    const { company, department } = options;

    const raw = await deps.rawStore.load(company.domain, department);
    if (!raw) {
      return ok(undefined);
    }

    const scoreResult = await scoreCompanyScan(
      raw,
      {
        leadExporter: deps.leadExporter,
        emailVerifier: deps.emailVerifier,
        emailVerificationRepository: deps.emailVerificationRepository,
        emailPatternRepository: deps.emailPatternRepository,
        idGenerator: deps.idGenerator,
      },
    );

    if (scoreResult.isErr()) {
      return err(scoreResult.error);
    }

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function runCompanyScan(
  options: CompanyScanOptions,
  deps: RunCompanyScanWithStoreDependencies,
  phase: CompanyScanPhase = "all",
): Promise<Result<void, Error>> {
  if (phase === "collect") {
    const collectResult = await collectCompanyScan(options, deps);
    if (collectResult.isErr()) {
      return err(collectResult.error);
    }
    return ok(undefined);
  }

  if (phase === "score") {
    const scoreResult = await scoreCompanyScanFromStored(
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
    if (scoreResult.isErr()) {
      return err(scoreResult.error);
    }
    return ok(undefined);
  }

  const rawResult = await collectCompanyScan(options, deps);
  if (rawResult.isErr()) {
    return err(rawResult.error);
  }

  const scoreResult = await scoreCompanyScan(
    rawResult.value,
    {
      leadExporter: deps.leadExporter,
      emailVerifier: deps.emailVerifier,
      emailVerificationRepository: deps.emailVerificationRepository,
      emailPatternRepository: deps.emailPatternRepository,
      idGenerator: deps.idGenerator,
    },
  );

  if (scoreResult.isErr()) {
    return err(scoreResult.error);
  }

  return ok(undefined);
}
