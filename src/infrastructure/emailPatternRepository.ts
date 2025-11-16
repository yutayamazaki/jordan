import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  EmailPatternRecord,
  EmailPatternRecordSchema,
} from "../domain";
import { EmailPatternRepository } from "../application/ports";
import { randomUUID } from "crypto";

type EmailPatternCache = EmailPatternRecord[];

const BASE_DIR = "outputs";
const FILE_PATH = join(BASE_DIR, "email_patterns.json");

function ensureBaseDir(): void {
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }
}

function loadCache(): EmailPatternCache {
  if (!existsSync(FILE_PATH)) {
    return [];
  }

  try {
    const raw = readFileSync(FILE_PATH, { encoding: "utf8" });
    if (!raw.trim()) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        const result = EmailPatternRecordSchema.safeParse(item);
        if (!result.success) return null;
        return result.data;
      })
      .filter((r): r is EmailPatternRecord => r !== null);
  } catch {
    return [];
  }
}

function saveCache(cache: EmailPatternCache): void {
  ensureBaseDir();
  writeFileSync(FILE_PATH, JSON.stringify(cache, null, 2), {
    encoding: "utf8",
  });
}

function isWithinDays(date: Date, days: number): boolean {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const limitMs = days * 24 * 60 * 60 * 1000;
  return diffMs >= 0 && diffMs <= limitMs;
}

export class FileEmailPatternRepository implements EmailPatternRepository {
  async findRecentByDomain(
    domain: string,
    maxAgeDays: number,
  ): Promise<EmailPatternRecord | null> {
    const cache = loadCache();

    const recordsForDomain = cache.filter(
      (r) => r.domain === domain,
    );

    if (recordsForDomain.length === 0) {
      return null;
    }

    const sorted = recordsForDomain
      .map((r) => ({
        record: r,
        verifiedAt: r.verifiedAt ? new Date(r.verifiedAt) : null,
      }))
      .filter((x): x is { record: EmailPatternRecord; verifiedAt: Date } => x.verifiedAt !== null);

    if (sorted.length === 0) {
      return null;
    }

    sorted.sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime());

    const latest = sorted[0];
    if (!isWithinDays(latest.verifiedAt, maxAgeDays)) {
      return null;
    }

    return latest.record;
  }

  async save(record: EmailPatternRecord): Promise<void> {
    const cache = loadCache();

    const nowIso = new Date().toISOString();

    const existing = cache.find(
      (r) => r.domain === record.domain && r.pattern === record.pattern,
    );

    const successCount =
      (existing?.successCount ?? 0) + (record.successCount ?? 0);
    const totalCount =
      (existing?.totalCount ?? 0) + (record.totalCount ?? 0);

    const others = cache.filter(
      (r) => !(r.domain === record.domain && r.pattern === record.pattern),
    );

    const nextRecord: EmailPatternRecord = EmailPatternRecordSchema.parse({
      id: record.id ?? existing?.id ?? randomUUID(),
      companyId: record.companyId,
      pattern: record.pattern,
      reason: record.reason,
      domain: record.domain,
      source: record.source,
      sampleEmail: record.sampleEmail ?? existing?.sampleEmail,
      verifiedAt: record.verifiedAt ?? existing?.verifiedAt ?? nowIso,
      successCount,
      totalCount,
    });

    const next = [...others, nextRecord];
    saveCache(next);
  }
}
