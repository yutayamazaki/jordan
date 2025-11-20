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

export function createRunCompanyScanDeps(): RunCompanyScanWithStoreDependencies {
  const emailPatternDetector = new LlmEmailPatternDetector();
  const contactSearchCachesRepository = new SqliteContactSearchCachesRepository();
  const contactFinder = new LlmContactFinder(contactSearchCachesRepository);
  const leadExporter = new SqliteLeadExporter();
  const idGenerator = new UuidGenerator();
  const emailVerifier = new EmailHippoApiEmailVerifier();
  const emailVerificationRepository = new SqliteEmailVerificationRepository();
  const rawStore = new SqliteCompanyScanRawStore();
  const emailPatternRepository = new SqliteEmailPatternRepository();

  return {
    emailPatternDetector,
    contactFinder,
    emailVerifier,
    leadExporter,
    idGenerator,
    emailVerificationRepository,
    rawStore,
    emailPatternRepository,
  };
}
