import { Company } from "../domain/entities/company";

export type SingleCompanyCliOptions = {
  mode: "single";
  company: Company;
  department: string;
  debug: boolean;
};

export type CsvCliOptions = {
  mode: "csv";
  csvPath: string;
  debug: boolean;
};

export type CliOptions = SingleCompanyCliOptions | CsvCliOptions;

export function parseCliArgs(): CliOptions {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const debug = args.includes("--debug");

  // CSV モード: 1 つの位置引数（CSV パス）のみ
  if (positional.length === 1) {
    const [csvPath] = positional;
    return {
      mode: "csv",
      csvPath,
      debug,
    };
  }

  // 単一企業モード: <companyName> <companyDomain> <department>
  if (positional.length >= 3) {
    const [name, domain, department] = positional;

    const company: Company = {
      name,
      domain,
    };

    return {
      mode: "single",
      company,
      department,
      debug,
    };
  }

  throw new Error(
    "Usage: node dist/index.js <companyName> <companyDomain> <department> [--debug] | node dist/index.js <companiesCsvPath> [--debug]",
  );
}
