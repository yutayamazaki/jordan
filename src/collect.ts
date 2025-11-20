import "dotenv/config";
import { parseCliArgs } from "./cli/parseCliArgs";
import { loadCompaniesFromCsv } from "./cli/loadCompaniesFromCsv";
import { runCompanyScan } from "./application/runCompanyScan";
import { createRunCompanyScanDeps } from "./bootstrap/deps";
import { err, ok, Result } from "neverthrow";

async function main() {
  const optionsResult = parseCliArgs("collect");
  if (optionsResult.isErr()) {
    console.error("Error:", optionsResult.error.message);
    process.exit(1);
  }
  const options = optionsResult.value;

  const depsResult = createRunCompanyScanDeps();
  if (depsResult.isErr()) {
    console.error("Error:", depsResult.error.message);
    process.exit(1);
  }
  const deps = depsResult.value;

  const onExists = options.onExists ?? "skip";

  const companiesResult = loadCompaniesFromCsv(options.csvPath);
  if (companiesResult.isErr()) {
    console.error("Error:", companiesResult.error.message);
    process.exit(1);
  }

  const companies = companiesResult.value;

  if (companies.length === 0) {
    console.log("No companies found in CSV.");
    return;
  }

  const maxConcurrencyFromEnv = process.env.COLLECT_CONCURRENCY;
  const maxConcurrency =
    maxConcurrencyFromEnv !== undefined
      ? Number(maxConcurrencyFromEnv)
      : 20;

  const concurrency =
    Number.isFinite(maxConcurrency) && maxConcurrency > 0
      ? maxConcurrency
      : 20;

  const queue = [...companies];

  async function worker(): Promise<Result<void, Error>> {
    for (;;) {
      const next = queue.shift();
      if (!next) {
        break;
      }

      const { company, department } = next;

      const existing = await deps.rawStore.load(company.domain, department);

      if (existing && onExists === "skip") {
        console.log(
          `[COLLECT] Skipped company: ${company.name} (${company.domain}) / Department: ${department} (existing scan found)`,
        );
        continue;
      }

      console.log(
        `[COLLECT] Processing company: ${company.name} (${company.domain}) / Department: ${department}`,
      );

      const scanResult = await runCompanyScan(
        {
          company,
          department,
        },
        deps,
        "collect",
      );

      if (scanResult.isErr()) {
        return err(scanResult.error);
      }
    }

    return ok(undefined);
  }

  const workerCount = Math.min(concurrency, companies.length);
  const workerResults = await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  const failed = workerResults.find((result) => result.isErr());
  if (failed?.isErr()) {
    console.error("Error:", failed.error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";
  console.error("Error:", message);
  process.exit(1);
});
