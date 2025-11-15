import { EmailPattern } from "../domain/entities/emailPattern";
import {
  CompanyRecord,
  ContactRecord,
  EmailCandidateRecord,
  EmailPatternRecord,
} from "../domain";
import { ContactResponse } from "../domain/entities/contact";

export interface EmailPatternDetector {
  detect(domain: string): Promise<EmailPattern | null>;
}

export interface ContactFinder {
  searchContacts(
    debug: boolean,
    companyName: string,
    domain: string,
    department: string,
  ): Promise<ContactResponse[]>;
}

export interface LeadExporter {
  export(
    domain: string,
    companyRecords: CompanyRecord[],
    contactRecords: ContactRecord[],
    emailCandidateRecords: EmailCandidateRecord[],
    emailPatternRecords: EmailPatternRecord[],
  ): Promise<void>;
}

export interface IdGenerator {
  generate(): string;
}

