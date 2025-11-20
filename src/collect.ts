import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { loadCompaniesFromCsv } from "./cli/loadCompaniesFromCsv";
import { runCompanyScan } from "./application/runCompanyScan";
import { createRunCompanyScanDeps } from "./bootstrap/deps";

async function main() {
  try {
    const options = parseCliArgs("collect");
    const deps = createRunCompanyScanDeps();

    const onExists = options.onExists ?? "skip";

    const companies = loadCompaniesFromCsv(options.csvPath);

    if (companies.length === 0) {
      console.log("No companies found in CSV.");
      return;
    }

    const maxConcurrencyFromEnv = process.env.COLLECT_CONCURRENCY;
    const maxConcurrency =
      maxConcurrencyFromEnv !== undefined
        ? Number(maxConcurrencyFromEnv)
        : 10;

    const concurrency =
      Number.isFinite(maxConcurrency) && maxConcurrency > 0
        ? maxConcurrency
        : 10;

    const queue = [...companies];

    async function worker() {
      for (;;) {
        const next = queue.shift();
        if (!next) {
          break;
        }

        const { company, department } = next;

        const existing = await deps.rawStore.load(company.domain, department);

        if (existing && onExists === "skip") {
          console.log(
            `\n==============================\n[COLLECT] Skipped company: ${company.name} (${company.domain}) / Department: ${department} (existing scan found)\n==============================`,
          );
          continue;
        }

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
    }

    const workerCount = Math.min(concurrency, companies.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
