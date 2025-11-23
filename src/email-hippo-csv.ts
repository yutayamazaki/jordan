import "dotenv/config";
import { runCompanyScan } from "./application/runCompanyScan";
import { createRunCompanyScanDeps } from "./bootstrap/deps";
import { getDb } from "./infrastructure/sqliteClient";

type LatestCompanyScanRow = {
  company_id: string;
  company_name: string;
  company_domain: string;
  department: string;
};

function parseEmailVerificationCsvPath(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--email-verifications-csv="));
  if (!arg) {
    return null;
  }
  const value = arg.split("=")[1]?.trim();
  return value && value.length > 0 ? value : null;
}

async function main() {
  const emailVerificationCsvPath = parseEmailVerificationCsvPath();
  if (!emailVerificationCsvPath) {
    console.error(
      "--email-verifications-csv=<path> を指定してください (EmailHippo API の代わりに CSV を使用します)",
    );
    process.exit(1);
  }

  const depsResult = createRunCompanyScanDeps({
    emailVerificationCsvPath,
  });
  if (depsResult.isErr()) {
    console.error("Error:", depsResult.error.message);
    process.exit(1);
  }
  const deps = depsResult.value;

  const db = getDb();

  // company_scans テーブルから、ドメイン x 部署ごとの最新スキャンを取得
  const latestScans = db
    .prepare(
      `
        SELECT
          cs.company_id,
          cs.company_name,
          cs.company_domain,
          cs.department
        FROM company_scans cs
        INNER JOIN (
          SELECT
            company_domain,
            department,
            MAX(created_at) AS max_created_at
          FROM company_scans
          GROUP BY company_domain, department
        ) latest
          ON latest.company_domain = cs.company_domain
          AND latest.department = cs.department
          AND latest.max_created_at = cs.created_at
        `,
    )
    .all() as LatestCompanyScanRow[];

  if (latestScans.length === 0) {
    console.log(
      "No company_scans found. Please run collect phase first.",
    );
    return;
  }

  const hasGoodPrimaryEmailStmt = db.prepare(
    `
      SELECT 1
      FROM contacts c
      JOIN email_candidates ec ON ec.contact_id = c.id
      WHERE
        c.company_id = @companyId
        AND ec.is_primary = 1
        AND ec.is_deliverable = 1
        AND ec.confidence >= 0.8
      LIMIT 1
      `,
  );

  // 「適切なメールアドレス（deliverable かつ一定以上の confidence を持つ primary）が
  //  見つかっていない会社」のみを score 対象とする
  const targets = latestScans.filter((scan) => {
    const row = hasGoodPrimaryEmailStmt.get({
      companyId: scan.company_id,
    }) as { 1?: number } | undefined;
    return !row;
  });

  if (targets.length === 0) {
    console.log(
      "All latest company_scans already have acceptable primary email candidates. Nothing to score.",
    );
    return;
  }

  console.log(
    `Found ${targets.length} company scan(s) without acceptable primary email candidates. Running score phase for them using EmailHippo CSV...`,
  );

  for (const scan of targets) {
    const company = {
      name: scan.company_name,
      domain: scan.company_domain,
    };
    const department = scan.department;

    console.log(
      `\n[SCORE-CSV] Processing company: ${company.name} (${company.domain}) / Department: ${department}\n`,
    );

    const runResult = await runCompanyScan(
      {
        company,
        department,
      },
      deps,
      "score",
    );

    if (runResult.isErr()) {
      console.error("Error:", runResult.error.message);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown error occurred";
  console.error("Error:", message);
  process.exit(1);
});
