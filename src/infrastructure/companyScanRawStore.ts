import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  CompanyScanRawData,
  CompanyScanRawStore,
} from "../application/runCompanyScan";

const BASE_DIR = "outputs/company_scans";

function ensureBaseDir(): void {
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function getFilePath(domain: string, department: string): string {
  const safeDomain = slugify(domain);
  const safeDepartment = slugify(department);
  const fileName = `${safeDomain}__${safeDepartment}.json`;
  return join(BASE_DIR, fileName);
}

export class FileCompanyScanRawStore implements CompanyScanRawStore {
  async save(raw: CompanyScanRawData): Promise<void> {
    ensureBaseDir();
    const filePath = getFilePath(raw.company.domain, raw.department);
    writeFileSync(filePath, JSON.stringify(raw, null, 2), {
      encoding: "utf8",
    });
  }

  async load(
    domain: string,
    department: string,
  ): Promise<CompanyScanRawData | null> {
    const filePath = getFilePath(domain, department);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const raw = readFileSync(filePath, { encoding: "utf8" });
      if (!raw.trim()) {
        return null;
      }

      const parsed = JSON.parse(raw) as CompanyScanRawData;
      return parsed;
    } catch {
      return null;
    }
  }
}

