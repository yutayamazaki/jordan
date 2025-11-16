export type ScanPhase = "collect" | "score" | "all";

export type CsvCliOptions = {
  csvPath: string;
  phase: ScanPhase;
  emailVerificationCsvPath?: string;
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
      emailVerificationCsvPath,
    };
  }

  throw new Error(
    "Usage: node dist/index.js <companiesCsvPath> [--phase=collect|score|all]",
  );
}
