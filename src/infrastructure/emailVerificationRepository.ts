import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import {
  EmailVerificationRecord,
  EmailVerificationRecordSchema,
} from "../domain";
import {
  EmailVerificationRepository,
  EmailVerificationResult,
} from "../application/ports";
import { randomUUID } from "crypto";

type EmailVerificationCache = EmailVerificationRecord[];

const BASE_DIR = "outputs";
const FILE_PATH = `${BASE_DIR}/email_verifications.json`;

function ensureBaseDir(): void {
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }
}

function loadCache(): EmailVerificationCache {
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
        const result = EmailVerificationRecordSchema.safeParse(item);
        if (!result.success) return null;
        return result.data;
      })
      .filter((r): r is EmailVerificationRecord => r !== null);
  } catch {
    return [];
  }
}

function saveCache(cache: EmailVerificationCache): void {
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

export class FileEmailVerificationRepository
  implements EmailVerificationRepository
{
  async findRecent(
    email: string,
    maxAgeDays: number,
  ): Promise<EmailVerificationResult | null> {
    const cache = loadCache();
    const record = cache.find((r) => r.email === email);
    if (!record) return null;

    const verifiedAt = new Date(record.verifiedAt);
    if (!isWithinDays(verifiedAt, maxAgeDays)) {
      return null;
    }

    return {
      email: record.email,
      isDeliverable: record.isDeliverable,
      hasMxRecords: record.hasMxRecords,
      reason: record.reason,
    };
  }

  async save(result: EmailVerificationResult): Promise<void> {
    const cache = loadCache();
    const nowIso = new Date().toISOString();

    const others = cache.filter((r) => r.email !== result.email);
    const record: EmailVerificationRecord = EmailVerificationRecordSchema.parse(
      {
        id: randomUUID(),
        email: result.email,
        isDeliverable: result.isDeliverable,
        hasMxRecords: result.hasMxRecords,
        reason: result.reason,
        verifiedAt: nowIso,
      },
    );

    const next = [...others, record];
    saveCache(next);
  }
}

