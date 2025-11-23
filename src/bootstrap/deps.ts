import { LlmEmailPatternDetector } from "../adapters/llmEmailPatternDetector";
import { LlmContactFinder } from "../adapters/llmContactFinder";
import { EmailHippoApiEmailVerifier } from "../adapters/emailHippoApiEmailVerifier";
import { EmailHippoCsvEmailVerifier } from "../adapters/emailHippoCsvEmailVerifier";
import { SqliteLeadExporter } from "../infrastructure/sqliteLeadExporter";
import { UuidGenerator } from "../infrastructure/idGenerator";
import { SqliteEmailVerificationRepository } from "../infrastructure/sqliteEmailVerificationRepository";
import { SqliteCompanyScanRawStore } from "../infrastructure/sqliteCompanyScanRawStore";
import { SqliteEmailPatternRepository } from "../infrastructure/sqliteEmailPatternRepository";
import { SqliteContactSearchCachesRepository } from "../infrastructure/sqliteContactSearchCachesRepository";
import { RunCompanyScanWithStoreDependencies } from "../application/runCompanyScan";
import { loadEmailHippoCsv } from "../infrastructure/emailHippoCsvLoader";
import { err, ok, Result } from "neverthrow";

export type CreateRunCompanyScanDepsOptions = {
  emailVerificationCsvPath?: string;
};

export function createRunCompanyScanDeps(
  options?: CreateRunCompanyScanDepsOptions,
): Result<RunCompanyScanWithStoreDependencies, Error> {
  const emailPatternDetector = new LlmEmailPatternDetector();
  const contactSearchCachesRepository = new SqliteContactSearchCachesRepository();
  const contactFinder = new LlmContactFinder(contactSearchCachesRepository);
  const leadExporter = new SqliteLeadExporter();
  const idGenerator = new UuidGenerator();
  const emailVerificationRepository = new SqliteEmailVerificationRepository();
  const rawStore = new SqliteCompanyScanRawStore();
  const emailPatternRepository = new SqliteEmailPatternRepository();

  let emailVerifierResult;
  if (options?.emailVerificationCsvPath) {
    const csvResult = loadEmailHippoCsv(options.emailVerificationCsvPath);
    if (csvResult.isErr()) {
      return err(csvResult.error);
    }
    emailVerifierResult = ok(new EmailHippoCsvEmailVerifier(csvResult.value));
  } else {
    emailVerifierResult = EmailHippoApiEmailVerifier.create();
  }

  if (emailVerifierResult.isErr()) {
    return err(emailVerifierResult.error);
  }
  const emailVerifier = emailVerifierResult.value;

  return ok({
    emailPatternDetector,
    contactFinder,
    emailVerifier,
    leadExporter,
    idGenerator,
    emailVerificationRepository,
    rawStore,
    emailPatternRepository,
  });
}
