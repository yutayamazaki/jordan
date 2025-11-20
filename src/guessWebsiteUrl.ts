import "dotenv/config";
import http from "http";
import https from "https";
import { err, ok, Result, ResultAsync } from "neverthrow";
import { getDb } from "./infrastructure/sqliteClient";

type CompanyRow = {
  id: string;
  name: string;
  domain: string;
  website_url: string | null;
  favicon_url: string | null;
};

function buildCandidates(domain: string): string[] {
  const trimmed = domain.trim();

  if (!trimmed) {
    return [];
  }

  // すでにプロトコル付きならそのまま利用
  if (/^https?:\/\//i.test(trimmed)) {
    return [trimmed];
  }

  const base = trimmed.replace(/^www\./i, "");
  const candidates = new Set<string>();

  // 代表的な候補を順番に試す
  candidates.add(`https://${base}`);
  candidates.add(`https://www.${base}`);

  return Array.from(candidates);
}

function ensureWebsiteColumns(db: any): Result<void, Error> {
  try {
    const columns = db
      .prepare("PRAGMA table_info(companies)")
      .all() as { name: string }[];

    const hasWebsiteUrl = columns.some((c) => c.name === "website_url");
    const hasFaviconUrl = columns.some((c) => c.name === "favicon_url");

    if (!hasWebsiteUrl) {
      db.prepare("ALTER TABLE companies ADD COLUMN website_url TEXT").run();
    }

    if (!hasFaviconUrl) {
      db.prepare("ALTER TABLE companies ADD COLUMN favicon_url TEXT").run();
    }

    return ok(undefined);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error("Failed to ensure website_url / favicon_url columns")
    );
  }
}

function loadCompanies(db: any): Result<CompanyRow[], Error> {
  try {
    const companies = db
      .prepare(
        "SELECT id, name, domain, website_url, favicon_url FROM companies ORDER BY domain"
      )
      .all() as CompanyRow[];

    return ok(companies);
  } catch (error) {
    return err(error instanceof Error ? error : new Error("Failed to load companies"));
  }
}

function checkUrl(url: string, timeoutMs = 5000): ResultAsync<boolean, Error> {
  return ResultAsync.fromPromise(
    new Promise<boolean>((resolve) => {
      const lib = url.startsWith("https") ? https : http;

      const req = lib.request(
        url,
        { method: "HEAD", timeout: timeoutMs },
        (res) => {
          const status = res.statusCode ?? 0;
          const okStatus = status >= 200 && status < 400;
          res.resume();
          resolve(okStatus);
        }
      );

      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    }),
    (error) =>
      error instanceof Error ? error : new Error("Unknown HTTP request error")
  );
}

async function chooseWebsiteUrl(domain: string): Promise<Result<string | null, Error>> {
  const candidates = buildCandidates(domain);

  for (const url of candidates) {
    const result = await checkUrl(url);
    if (result.isErr()) {
      return err(result.error);
    }
    if (result.value) {
      return ok(url);
    }
  }

  return ok(null);
}

function buildFaviconCandidates(websiteUrl: string): Result<string[], Error> {
  try {
    const parsed = new URL(websiteUrl);
    const origin = parsed.origin;
    const paths = [
      "/favicon.ico",
      "/favicon.png",
      "/favicon.svg",
      "/apple-touch-icon.png",
      "/apple-touch-icon-precomposed.png",
    ];

    const urls = paths.map((path) => new URL(path, origin).toString());

    return ok(Array.from(new Set(urls)));
  } catch {
    return ok([]);
  }
}

async function chooseFaviconUrl(websiteUrl: string): Promise<Result<string | null, Error>> {
  const candidatesResult = buildFaviconCandidates(websiteUrl);
  if (candidatesResult.isErr()) {
    return err(candidatesResult.error);
  }

  for (const url of candidatesResult.value) {
    const result = await checkUrl(url);
    if (result.isErr()) {
      return err(result.error);
    }
    if (result.value) {
      return ok(url);
    }
  }

  return ok(null);
}

async function resolveCompanyUrls(
  company: CompanyRow
): Promise<Result<{ websiteUrl: string | null; faviconUrl: string | null }, Error>> {
  const existingWebsite = company.website_url?.trim() ?? "";
  const existingFavicon = company.favicon_url?.trim() ?? "";

  let websiteUrl = existingWebsite;

  if (!websiteUrl) {
    const websiteResult = await chooseWebsiteUrl(company.domain);
    if (websiteResult.isErr()) {
      return err(websiteResult.error);
    }
    websiteUrl = websiteResult.value ?? "";
  }

  if (!websiteUrl) {
    return ok({ websiteUrl: null, faviconUrl: null });
  }

  let faviconUrl = existingFavicon;

  if (!faviconUrl) {
    const faviconResult = await chooseFaviconUrl(websiteUrl);
    if (faviconResult.isErr()) {
      return err(faviconResult.error);
    }
    faviconUrl = faviconResult.value ?? "";
  }

  return ok({
    websiteUrl,
    faviconUrl: faviconUrl || null,
  });
}

function updateCompanyUrls(
  updateStmt: any,
  companyId: string,
  websiteUrl: string,
  faviconUrl: string | null
): Result<void, Error> {
  try {
    updateStmt.run(websiteUrl || null, faviconUrl || null, companyId);
    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error("Failed to update company URLs"));
  }
}

async function run(): Promise<Result<void, Error>> {
  try {
    const db = getDb();

    const ensureResult = ensureWebsiteColumns(db);
    if (ensureResult.isErr()) {
      return err(ensureResult.error);
    }

    const companiesResult = loadCompanies(db);
    if (companiesResult.isErr()) {
      return err(companiesResult.error);
    }
    const companies = companiesResult.value;

    if (companies.length === 0) {
      console.log("No companies found in database.");
      return ok(undefined);
    }

    const updateStmt = db.prepare(
      "UPDATE companies SET website_url = ?, favicon_url = ? WHERE id = ?"
    );

    let updated = 0;
    let skipped = 0;

    for (const company of companies) {
      console.log(
        `Resolving website URL for: ${company.name} (${company.domain})...`
      );

      const urlsResult = await resolveCompanyUrls(company);
      if (urlsResult.isErr()) {
        return err(urlsResult.error);
      }

      const { websiteUrl, faviconUrl } = urlsResult.value;

      if (!websiteUrl) {
        skipped++;
        continue;
      }

      const updateResult = updateCompanyUrls(
        updateStmt,
        company.id,
        websiteUrl,
        faviconUrl
      );
      if (updateResult.isErr()) {
        return err(updateResult.error);
      }

      updated++;
    }

    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error : new Error("Unknown error occurred"));
  }
}

async function main() {
  const result = await run();
  if (result.isErr()) {
    console.error("Error while guessing website URLs:", result.error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";
  console.error("Error while guessing website URLs:", message);
  process.exit(1);
});
