import { getDb } from "./infrastructure/sqliteClient";

type ShowDomainOptions = {
  domain: string;
};

function parseShowDomainArgs(): ShowDomainOptions {
  const [, , ...args] = process.argv;

  let domain: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--domain" || arg === "-d") {
      domain = args[i + 1];
      i++;
      continue;
    }

    if (arg.startsWith("--domain=")) {
      domain = arg.split("=")[1];
      continue;
    }
  }

  if (!domain) {
    console.error(
      "Usage: npm run show-domain -- --domain example.com",
    );
    process.exit(1);
  }

  return { domain };
}

type CompanyRow = {
  id: string;
  name: string;
  domain: string;
};

type EmailPatternRow = {
  pattern: string;
  reason: string;
  source: string | null;
  sample_email: string | null;
  verified_at: string | null;
  success_count: number | null;
  total_count: number | null;
};

type ContactRow = {
  id: string;
  name: string;
  position: string;
  department: string;
  department_category: string;
};

type EmailCandidateRow = {
  email: string;
  is_primary: number;
  confidence: number;
  type: string;
  pattern: string | null;
  is_deliverable: number | null;
  verification_reason: string | null;
};

function formatBoolean(value: number | null): string {
  if (value === null || value === undefined) {
    return "unknown";
  }
  return value === 1 ? "yes" : "no";
}

function printCompanyHeader(company: CompanyRow): void {
  console.log(
    `\n==============================\nCompany: ${company.name} (${company.domain})\n==============================`,
  );
}

function printEmailPatterns(patterns: EmailPatternRow[]): void {
  console.log("\n[Email Patterns]");
  if (patterns.length === 0) {
    console.log("  (no patterns found)");
    return;
  }

  for (const p of patterns) {
    const success =
      p.success_count !== null && p.total_count !== null
        ? `${p.success_count}/${p.total_count}`
        : "n/a";
    const verifiedAt = p.verified_at ?? "n/a";
    const source = p.source ?? "n/a";
    const sample = p.sample_email ?? "n/a";
    console.log(
      `  - pattern: ${p.pattern} | source: ${source} | success: ${success} | sample: ${sample} | verifiedAt: ${verifiedAt}`,
    );
    console.log(`    reason: ${p.reason}`);
  }
}

function printContactsWithEmails(
  contacts: ContactRow[],
  emailByContactId: Map<string, EmailCandidateRow[]>,
): void {
  console.log("\n[Contacts and Email Candidates]");
  if (contacts.length === 0) {
    console.log("  (no contacts found)");
    return;
  }

  for (const contact of contacts) {
    console.log(
      `\n${contact.name} | position: ${contact.position} | department: ${contact.department} (${contact.department_category})`,
    );
    const emails = (emailByContactId.get(contact.id) ?? []).filter(
      (email) => email.confidence >= 0.9,
    );
    if (emails.length === 0) {
      console.log("      (no email candidates with confidence >= 0.9)");
      continue;
    }

    const sortedEmails = emails.slice().sort((a, b) => {
      if (a.is_primary !== b.is_primary) {
        return b.is_primary - a.is_primary;
      }
      return b.confidence - a.confidence;
    });

    for (const email of sortedEmails) {
      const primaryLabel = email.is_primary === 1 ? "primary" : "alt";
      const deliverable = formatBoolean(email.is_deliverable);
      console.log(
        `- [${primaryLabel}] ${email.email} | confidence: ${email.confidence.toFixed(
          2,
        )} | deliverable: ${deliverable}`,
      );
    }
  }
}

function main(): void {
  try {
    const options = parseShowDomainArgs();
    const db = getDb();

    const stmt = db.prepare(
      "SELECT id, name, domain FROM companies WHERE domain = ? ORDER BY name",
    );
    const companies: CompanyRow[] = stmt.all(options.domain);

    if (companies.length === 0) {
      console.log("No companies found for the given criteria.");
      return;
    }

    const patternStmt = db.prepare(
      "SELECT pattern, reason, source, sample_email, verified_at, success_count, total_count FROM email_patterns WHERE domain = ? ORDER BY verified_at DESC",
    );
    const contactsStmt = db.prepare(
      "SELECT id, name, position, department, department_category FROM contacts WHERE company_id = ? ORDER BY name",
    );
    const emailsStmt = db.prepare(
      "SELECT email, is_primary, confidence, type, pattern, is_deliverable, verification_reason FROM email_candidates WHERE contact_id = ?",
    );

    for (const company of companies) {
      printCompanyHeader(company);

      const patterns: EmailPatternRow[] = patternStmt.all(company.domain);
      printEmailPatterns(patterns);

      const contacts: ContactRow[] = contactsStmt.all(company.id);
      const emailByContactId = new Map<string, EmailCandidateRow[]>();

      for (const contact of contacts) {
        const emails: EmailCandidateRow[] = emailsStmt.all(contact.id);
        emailByContactId.set(contact.id, emails);
      }

      printContactsWithEmails(contacts, emailByContactId);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error:", message);
    process.exit(1);
  }
}

main();
