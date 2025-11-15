import { Company } from "../domain/entities/company";

export type CliOptions = {
  company: Company;
  department: string;
  debug: boolean;
};

export function parseCliArgs(): CliOptions {
  const [, , ...args] = process.argv;
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const debug = args.includes("--debug");

  if (positional.length < 3) {
    throw new Error(
      "Usage: node dist/index.js <companyName> <companyDomain> <department> [--debug]",
    );
  }

  const [name, domain, department] = positional;

  const company: Company = {
    name,
    domain,
  };

  return {
    company,
    department,
    debug,
  };
}
