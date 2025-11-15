import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
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

    await runCompanyScan(options, {
      emailPatternDetector,
      contactFinder,
      leadExporter,
      idGenerator,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
