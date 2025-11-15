import { LeadExporter } from "../application/ports";
import {
  CompanyRecord,
  ContactRecord,
  EmailCandidateRecord,
  EmailPatternRecord,
} from "../domain";
import { saveAsCsvFiles } from "../infrastructure/saveAsCsvFiles";

export class CsvLeadExporter implements LeadExporter {
  async export(
    domain: string,
    companyRecords: CompanyRecord[],
    contactRecords: ContactRecord[],
    emailCandidateRecords: EmailCandidateRecord[],
    emailPatternRecords: EmailPatternRecord[],
  ): Promise<void> {
    await saveAsCsvFiles(
      domain,
      companyRecords,
      contactRecords,
      emailCandidateRecords,
      emailPatternRecords,
    );
  }
}

