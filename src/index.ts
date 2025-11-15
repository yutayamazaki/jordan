import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { loadCompaniesFromCsv } from "./cli/loadCompaniesFromCsv";
import { runCompanyScan } from "./application/runCompanyScan";
import { LlmEmailPatternDetector } from "./adapters/llmEmailPatternDetector";
import { LlmContactFinder } from "./adapters/llmContactFinder";
import { CsvLeadExporter } from "./adapters/csvLeadExporter";
import { UuidGenerator } from "./infrastructure/idGenerator";

async function main() {
  try {
    const options = parseCliArgs();
    const emailPatternDetector = new LlmEmailPatternDetector();
    const contactFinder = new LlmContactFinder();
    const leadExporter = new CsvLeadExporter();
    const idGenerator = new UuidGenerator();

    if (options.mode === "single") {
      await runCompanyScan(
        {
          company: options.company,
          department: options.department,
          debug: options.debug,
        },
        {
          emailPatternDetector,
          contactFinder,
          leadExporter,
          idGenerator,
        },
      );
    } else {
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
            leadExporter,
            idGenerator,
          },
        );
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
