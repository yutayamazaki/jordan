export type ScanPhase = "collect" | "score" | "all";

export type OnExistsBehavior = "skip" | "overwrite";

export type CsvCliOptions = {
  csvPath: string;
  phase: ScanPhase;
  emailVerificationCsvPath?: string;
  onExists?: OnExistsBehavior;
};

export type CliOptions = CsvCliOptions;

import { err, ok, Result } from "neverthrow";

export function parseCliArgs(defaultPhase: ScanPhase = "all"): Result<CliOptions, Error> {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));

  const phaseArg = args.find((arg) => arg.startsWith("--phase="));
  const phaseValue = phaseArg ? phaseArg.split("=")[1] : undefined;
  let phase: ScanPhase = defaultPhase;
  if (phaseValue) {
    if (phaseValue === "collect" || phaseValue === "score" || phaseValue === "all") {
      phase = phaseValue;
    } else {
      return err(new Error("Invalid --phase option. Use one of: collect, score, all"));
    }
  }

  const onExistsArg = args.find((arg) => arg.startsWith("--on-exists="));
  let onExists: OnExistsBehavior | undefined;
  if (onExistsArg) {
    const value = onExistsArg.split("=")[1];
    if (value === "skip" || value === "overwrite") {
      onExists = value;
    } else {
      return err(new Error("Invalid --on-exists option. Use one of: skip, overwrite"));
    }
  }

  const emailVerificationsArg = args.find((arg) =>
    arg.startsWith("--email-verifications-csv="),
  );
  const emailVerificationCsvPath = emailVerificationsArg
    ? emailVerificationsArg.split("=")[1]
    : undefined;

  // CSV モード: 1 つの位置引数（CSV パス）のみ
  if (positional.length === 1) {
    const [csvPath] = positional;
    return ok({
      csvPath,
      phase,
      onExists,
      emailVerificationCsvPath,
    });
  }

  return err(
    new Error(
      "Usage: node dist/index.js <companiesCsvPath> [--phase=collect|score|all]",
    ),
  );
}
