import { mkdirSync, existsSync } from "fs";
import {
  CompanyRecord,
  ContactRecord,
  EmailCandidateRecord,
  EmailPatternRecord,
} from "../domain";

const createCsvWriter = require("csv-writer").createObjectCsvWriter;

export async function saveAsCsvFiles(
  domain: string,
  companyRecords: CompanyRecord[],
  contactRecords: ContactRecord[],
  emailCandidateRecords: EmailCandidateRecord[],
  emailPatternRecords: EmailPatternRecord[],
): Promise<void> {
  console.log("\n👺 Save results to CSV files ...");

  const domainDirName = domain.replace(/\./g, "_");
  const baseDir = `outputs/${domainDirName}`;
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const companyCsvWriter = createCsvWriter({
    path: `${baseDir}/companies.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "name", title: "Name" },
      { id: "domain", title: "Domain" },
    ],
  });

  const contactsCsvWriter = createCsvWriter({
    path: `${baseDir}/contacts.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "companyId", title: "Company ID" },
      { id: "name", title: "Name" },
      { id: "position", title: "Position" },
      { id: "department", title: "Department" },
      { id: "firstName", title: "First Name" },
      { id: "lastName", title: "Last Name" },
    ],
  });

  const emailCandidatesCsvWriter = createCsvWriter({
    path: `${baseDir}/email_candidates.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "contactId", title: "Contact ID" },
      { id: "email", title: "Email" },
      { id: "isPrimary", title: "Is Primary" },
      { id: "confidence", title: "Confidence" },
      { id: "type", title: "Type" },
      { id: "pattern", title: "Pattern" },
    ],
  });

  const emailPatternsCsvWriter = createCsvWriter({
    path: `${baseDir}/email_patterns.csv`,
    header: [
      { id: "id", title: "ID" },
      { id: "companyId", title: "Company ID" },
      { id: "pattern", title: "Pattern" },
      { id: "reason", title: "Reason" },
    ],
  });

  await companyCsvWriter.writeRecords(companyRecords);
  await contactsCsvWriter.writeRecords(contactRecords);
  await emailCandidatesCsvWriter.writeRecords(emailCandidateRecords);
  await emailPatternsCsvWriter.writeRecords(emailPatternRecords);

  console.log("The CSV files were written successfully");
}
