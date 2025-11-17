export type ScanPhase = "collect" | "score" | "all";

export type OnExistsBehavior = "skip" | "overwrite";

export type CsvCliOptions = {
  csvPath: string;
  phase: ScanPhase;
  emailVerificationCsvPath?: string;
  onExists?: OnExistsBehavior;
};

export type CliOptions = CsvCliOptions;

export function parseCliArgs(defaultPhase: ScanPhase = "all"): CliOptions {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));

  const phaseArg = args.find((arg) => arg.startsWith("--phase="));
  const phaseValue = phaseArg ? phaseArg.split("=")[1] : undefined;
  const phase: ScanPhase = (() => {
    if (!phaseValue) return defaultPhase;
    if (phaseValue === "collect" || phaseValue === "score" || phaseValue === "all") {
      return phaseValue;
    }
    throw new Error(
      "Invalid --phase option. Use one of: collect, score, all",
    );
  })();

  const onExistsArg = args.find((arg) => arg.startsWith("--on-exists="));
  const onExists: OnExistsBehavior | undefined = (() => {
    if (!onExistsArg) return undefined;
    const value = onExistsArg.split("=")[1];
    if (value === "skip" || value === "overwrite") {
      return value;
    }
    throw new Error(
      "Invalid --on-exists option. Use one of: skip, overwrite",
    );
  })();

  const emailVerificationsArg = args.find((arg) =>
    arg.startsWith("--email-verifications-csv="),
  );
  const emailVerificationCsvPath = emailVerificationsArg
    ? emailVerificationsArg.split("=")[1]
    : undefined;

  // CSV モード: 1 つの位置引数（CSV パス）のみ
  if (positional.length === 1) {
    const [csvPath] = positional;
    return {
      csvPath,
      phase,
      onExists,
      emailVerificationCsvPath,
    };
  }

  throw new Error(
    "Usage: node dist/index.js <companiesCsvPath> [--phase=collect|score|all]",
  );
}
