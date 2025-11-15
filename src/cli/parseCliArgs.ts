export type ScanPhase = "collect" | "score" | "all";

export type CsvCliOptions = {
  csvPath: string;
  debug: boolean;
  phase: ScanPhase;
};

export type CliOptions = CsvCliOptions;

export function parseCliArgs(): CliOptions {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const debug = args.includes("--debug");

  const phaseArg = args.find((arg) => arg.startsWith("--phase="));
  const phaseValue = phaseArg ? phaseArg.split("=")[1] : undefined;
  const phase: ScanPhase = (() => {
    if (!phaseValue) return "all";
    if (phaseValue === "collect" || phaseValue === "score" || phaseValue === "all") {
      return phaseValue;
    }
    throw new Error(
      "Invalid --phase option. Use one of: collect, score, all",
    );
  })();

  // CSV モード: 1 つの位置引数（CSV パス）のみ
  if (positional.length === 1) {
    const [csvPath] = positional;
    return {
      csvPath,
      debug,
      phase,
    };
  }

  throw new Error(
    "Usage: node dist/index.js <companiesCsvPath> [--debug] [--phase=collect|score|all]",
  );
}
