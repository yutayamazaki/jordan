import { LlmEmailPatternDetector } from "../adapters/llmEmailPatternDetector";
import { LlmContactFinder } from "../adapters/llmContactFinder";
import { EmailHippoApiEmailVerifier } from "../adapters/emailHippoApiEmailVerifier";
import { SqliteLeadExporter } from "../infrastructure/sqliteLeadExporter";
import { UuidGenerator } from "../infrastructure/idGenerator";
import { SqliteEmailVerificationRepository } from "../infrastructure/sqliteEmailVerificationRepository";
import { SqliteCompanyScanRawStore } from "../infrastructure/sqliteCompanyScanRawStore";
import { SqliteEmailPatternRepository } from "../infrastructure/sqliteEmailPatternRepository";
import { SqliteContactSearchCachesRepository } from "../infrastructure/sqliteContactSearchCachesRepository";
import { RunCompanyScanWithStoreDependencies } from "../application/runCompanyScan";
import { err, ok, Result } from "neverthrow";

export function createRunCompanyScanDeps(): Result<RunCompanyScanWithStoreDependencies, Error> {
  const emailPatternDetector = new LlmEmailPatternDetector();
  const contactSearchCachesRepository = new SqliteContactSearchCachesRepository();
  const contactFinder = new LlmContactFinder(contactSearchCachesRepository);
  const leadExporter = new SqliteLeadExporter();
  const idGenerator = new UuidGenerator();
  const emailVerifierResult = EmailHippoApiEmailVerifier.create();
  if (emailVerifierResult.isErr()) {
    return err(emailVerifierResult.error);
  }
  const emailVerifier = emailVerifierResult.value;
  const emailVerificationRepository = new SqliteEmailVerificationRepository();
  const rawStore = new SqliteCompanyScanRawStore();
  const emailPatternRepository = new SqliteEmailPatternRepository();

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
