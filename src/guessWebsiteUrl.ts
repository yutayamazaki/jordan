import "dotenv/config";
import http from "http";
import https from "https";
import { getDb } from "./infrastructure/sqliteClient";

type CompanyRow = {
  id: string;
  name: string;
  domain: string;
  website_url: string | null;
  favicon_url: string | null;
};

function ensureWebsiteColumns(db: any): void {
  const columns = db
    .prepare("PRAGMA table_info(companies)")
    .all() as { name: string }[];

  const hasWebsiteUrl = columns.some((c) => c.name === "website_url");
  const hasFaviconUrl = columns.some((c) => c.name === "favicon_url");

  if (!hasWebsiteUrl) {
    db.prepare('ALTER TABLE companies ADD COLUMN website_url TEXT').run();
    console.log('Added column "website_url" to companies table.');
  }

  if (!hasFaviconUrl) {
    db.prepare('ALTER TABLE companies ADD COLUMN favicon_url TEXT').run();
    console.log('Added column "favicon_url" to companies table.');
  }
}

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

function checkUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;

    const req = lib.request(
      url,
      { method: "HEAD", timeout: timeoutMs },
      (res) => {
        const status = res.statusCode ?? 0;
        const ok = status >= 200 && status < 400;
        res.resume();
        resolve(ok);
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function chooseWebsiteUrl(domain: string): Promise<string | null> {
  const candidates = buildCandidates(domain);

  for (const url of candidates) {
    const ok = await checkUrl(url);
    if (ok) {
      return url;
    }
  }

  return null;
}

function buildFaviconCandidates(websiteUrl: string): string[] {
  try {
    const parsed = new URL(websiteUrl);
    const origin = parsed.origin;
    const paths = [
      "/favicon.ico",
      "/favicon.png",
      "/favicon.svg",
      "/apple-touch-icon.png",
      "/apple-touch-icon-precomposed.png"
    ];

    const urls = paths.map((path) => new URL(path, origin).toString());

    // 念のため重複を除去
    return Array.from(new Set(urls));
  } catch {
    return [];
  }
}

async function chooseFaviconUrl(websiteUrl: string): Promise<string | null> {
  const candidates = buildFaviconCandidates(websiteUrl);

  for (const url of candidates) {
    const ok = await checkUrl(url);
    if (ok) {
      return url;
    }
  }

  return null;
}

async function main() {
  try {
    const db = getDb();

    ensureWebsiteColumns(db);

    const companies = db
      .prepare(
        "SELECT id, name, domain, website_url, favicon_url FROM companies ORDER BY domain"
      )
      .all() as CompanyRow[];

    if (companies.length === 0) {
      console.log("No companies found in database.");
      return;
    }

    const updateStmt = db.prepare(
      "UPDATE companies SET website_url = ?, favicon_url = ? WHERE id = ?"
    );

    let updated = 0;
    let skipped = 0;

    for (const company of companies) {
      const existingWebsite = company.website_url?.trim() ?? "";
      const existingFavicon = company.favicon_url?.trim() ?? "";

      // すでに website_url が設定されている場合はスキップ
      // if (existingWebsite && existingFavicon) {
      //  skipped++;
      //  continue;
      //}

      console.log(
        `Resolving website URL for: ${company.name} (${company.domain})...`
      );

      let websiteUrl = existingWebsite;

      if (!websiteUrl) {
        websiteUrl = (await chooseWebsiteUrl(company.domain)) ?? "";
      }

      if (!websiteUrl) {
        console.warn(
          `  -> could not determine website URL for domain: ${company.domain}`
        );
        continue;
      }

      let faviconUrl = existingFavicon;

      if (!faviconUrl) {
        faviconUrl = (await chooseFaviconUrl(websiteUrl)) ?? "";
      }

      updateStmt.run(websiteUrl || null, faviconUrl || null, company.id);
      updated++;
      console.log(
        `  -> set website_url = ${websiteUrl}${
          faviconUrl ? `, favicon_url = ${faviconUrl}` : ", favicon_url skipped"
        }`
      );
    }

    console.log(`Done. Updated ${updated} companies (skipped ${skipped}).`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error while guessing website URLs:", message);
    process.exit(1);
  }
}

main();
