import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { loadCompaniesFromCsv } from "./cli/loadCompaniesFromCsv";
import { runCompanyScan } from "./application/runCompanyScan";
import { LlmEmailPatternDetector } from "./adapters/llmEmailPatternDetector";
import { LlmContactFinder } from "./adapters/llmContactFinder";
import { CsvLeadExporter } from "./adapters/csvLeadExporter";
import { UuidGenerator } from "./infrastructure/idGenerator";
import { DnsMxEmailVerifier } from "./adapters/dnsMxEmailVerifier";
import { FileEmailVerificationRepository } from "./infrastructure/emailVerificationRepository";
import { FileCompanyScanRawStore } from "./infrastructure/companyScanRawStore";

async function main() {
  try {
    const options = parseCliArgs();
    const emailPatternDetector = new LlmEmailPatternDetector();
    const contactFinder = new LlmContactFinder();
    const leadExporter = new CsvLeadExporter();
    const idGenerator = new UuidGenerator();
    const emailVerifier = new DnsMxEmailVerifier();
    const emailVerificationRepository = new FileEmailVerificationRepository();
    const rawStore = new FileCompanyScanRawStore();

    const companies = loadCompaniesFromCsv(options.csvPath);

    if (companies.length === 0) {
      console.log("No companies found in CSV.");
      return;
    }

    for (const { company, department } of companies) {
      console.log(
        `\n==============================\nProcessing company: ${company.name} (${company.domain}) / Department: ${department}\n==============================`,
      );

      await runCompanyScan(
        {
          company,
          department,
          debug: options.debug,
        },
        {
          emailPatternDetector,
          contactFinder,
          emailVerifier,
          leadExporter,
          idGenerator,
          emailVerificationRepository,
          rawStore,
        },
        options.phase,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
