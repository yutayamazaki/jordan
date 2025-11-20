import { readFileSync } from "fs";
import { Company } from "../domain/entities/company";
import { err, ok, Result } from "neverthrow";

export type CompanyCsvRow = {
  company: Company;
  department: string;
};

export function loadCompaniesFromCsv(path: string): Result<CompanyCsvRow[], Error> {
  try {
    const content = readFileSync(path, "utf8");

    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      return ok([]);
    }

    const header = lines[0]
      .split(",")
      .map((col) => col.trim().toLowerCase());

    const nameIndex = header.indexOf("name");
    const domainIndex = header.indexOf("domain");
    const departmentIndex = header.indexOf("department");

    if (nameIndex === -1 || domainIndex === -1 || departmentIndex === -1) {
      return err(
        new Error(
          'CSV header must include "name", "domain", and "department" columns',
        ),
      );
    }

    const rows: CompanyCsvRow[] = [];

    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((col) => col.trim());

      const name = cols[nameIndex];
      const domain = cols[domainIndex];
      const department = cols[departmentIndex] ?? "";

      if (!name || !domain) {
        continue;
      }

      rows.push({
        company: { name, domain },
        department,
      });
    }

    return ok(rows);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
