import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { loadCompaniesFromCsv } from "./cli/loadCompaniesFromCsv";
import { runCompanyScan } from "./application/runCompanyScan";
import { createRunCompanyScanDeps } from "./bootstrap/deps";

async function main() {
  try {
    const options = parseCliArgs("collect");
    const deps = createRunCompanyScanDeps();

    const companies = loadCompaniesFromCsv(options.csvPath);

    if (companies.length === 0) {
      console.log("No companies found in CSV.");
      return;
    }

    for (const { company, department } of companies) {
      console.log(
        `\n==============================\n[COLLECT] Processing company: ${company.name} (${company.domain}) / Department: ${department}\n==============================`,
      );

      await runCompanyScan(
        {
          company,
          department,
        },
        deps,
        "collect",
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
