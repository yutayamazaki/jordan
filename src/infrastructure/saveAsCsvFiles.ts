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

  const baseDir = "outputs";
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  for (const company of companyRecords) {
    const companyCsvWriter = createCsvWriter({
      path: `${baseDir}/company_${company.id}.csv`,
      header: [
        { id: "id", title: "ID" },
        { id: "name", title: "Name" },
        { id: "domain", title: "Domain" },
      ],
    });
    await companyCsvWriter.writeRecords([company]);
  }

  for (const contact of contactRecords) {
    const contactsCsvWriter = createCsvWriter({
      path: `${baseDir}/contact_${contact.id}.csv`,
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
    await contactsCsvWriter.writeRecords([contact]);
  }

  for (const candidate of emailCandidateRecords) {
    const emailCandidatesCsvWriter = createCsvWriter({
      path: `${baseDir}/email_candidate_${candidate.id}.csv`,
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
    await emailCandidatesCsvWriter.writeRecords([candidate]);
  }

  for (const pattern of emailPatternRecords) {
    const emailPatternsCsvWriter = createCsvWriter({
      path: `${baseDir}/email_pattern_${pattern.id}.csv`,
      header: [
        { id: "id", title: "ID" },
        { id: "companyId", title: "Company ID" },
        { id: "pattern", title: "Pattern" },
        { id: "reason", title: "Reason" },
      ],
    });
    await emailPatternsCsvWriter.writeRecords([pattern]);
  }

  console.log("The CSV files were written successfully");
}
