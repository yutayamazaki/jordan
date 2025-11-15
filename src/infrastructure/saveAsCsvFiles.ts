import { mkdirSync, existsSync, statSync, writeFileSync } from "fs";
import {
  CompanyRecord,
  ContactRecord,
  EmailCandidateRecord,
  EmailPatternRecord,
} from "../domain";

const createCsvWriter = require("csv-writer").createObjectCsvWriter;

function ensureCsvHeader(path: string, headers: { id: string; title: string }[]): void {
  const needsHeader = !existsSync(path) || statSync(path).size === 0;
  if (!needsHeader) {
    return;
  }

  const headerLine = headers.map((h) => h.title).join(",") + "\n";
  writeFileSync(path, headerLine, { encoding: "utf8" });
}

export async function saveAsCsvFiles(
  domain: string,
  companyRecords: CompanyRecord[],
  contactRecords: ContactRecord[],
  emailCandidateRecords: EmailCandidateRecord[],
  emailPatternRecords: EmailPatternRecord[],
): Promise<void> {
  console.log("\n👺 Save results to CSV files ...");

  const baseDir = "outputs";
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const companyCsvPath = `${baseDir}/companies.csv`;
  const companyHeaders = [
    { id: "id", title: "ID" },
    { id: "name", title: "Name" },
    { id: "domain", title: "Domain" },
  ] as const;
  ensureCsvHeader(
    companyCsvPath,
    companyHeaders.map((h) => ({ id: h.id, title: h.title })),
  );

  const companyCsvWriter = createCsvWriter({
    path: companyCsvPath,
    header: companyHeaders,
    append: true,
  });

  const contactsCsvPath = `${baseDir}/contacts.csv`;
  const contactsHeaders = [
    { id: "id", title: "ID" },
    { id: "companyId", title: "Company ID" },
    { id: "name", title: "Name" },
    { id: "position", title: "Position" },
    { id: "department", title: "Department" },
    { id: "departmentCategory", title: "Department Category" },
    { id: "firstName", title: "First Name" },
    { id: "lastName", title: "Last Name" },
  ] as const;
  ensureCsvHeader(
    contactsCsvPath,
    contactsHeaders.map((h) => ({ id: h.id, title: h.title })),
  );

  const contactsCsvWriter = createCsvWriter({
    path: contactsCsvPath,
    header: contactsHeaders,
    append: true,
  });

  const emailCandidatesCsvPath = `${baseDir}/email_candidates.csv`;
  const emailCandidatesHeaders = [
    { id: "id", title: "ID" },
    { id: "contactId", title: "Contact ID" },
    { id: "email", title: "Email" },
    { id: "isPrimary", title: "Is Primary" },
    { id: "confidence", title: "Confidence" },
    { id: "type", title: "Type" },
    { id: "pattern", title: "Pattern" },
    { id: "isDeliverable", title: "Is Deliverable" },
    { id: "hasMxRecords", title: "Has MX Records" },
    { id: "verificationReason", title: "Verification Reason" },
  ] as const;
  ensureCsvHeader(
    emailCandidatesCsvPath,
    emailCandidatesHeaders.map((h) => ({ id: h.id, title: h.title })),
  );

  const emailCandidatesCsvWriter = createCsvWriter({
    path: emailCandidatesCsvPath,
    header: emailCandidatesHeaders,
    append: true,
  });

  const emailPatternsCsvPath = `${baseDir}/email_patterns.csv`;
  const emailPatternsHeaders = [
    { id: "id", title: "ID" },
    { id: "companyId", title: "Company ID" },
    { id: "pattern", title: "Pattern" },
    { id: "reason", title: "Reason" },
  ] as const;
  ensureCsvHeader(
    emailPatternsCsvPath,
    emailPatternsHeaders.map((h) => ({ id: h.id, title: h.title })),
  );

  const emailPatternsCsvWriter = createCsvWriter({
    path: emailPatternsCsvPath,
    header: emailPatternsHeaders,
    append: true,
  });

  await companyCsvWriter.writeRecords(companyRecords);
  await contactsCsvWriter.writeRecords(contactRecords);
  await emailCandidatesCsvWriter.writeRecords(emailCandidateRecords);
  await emailPatternsCsvWriter.writeRecords(emailPatternRecords);

  console.log("The CSV files were written successfully");
}
