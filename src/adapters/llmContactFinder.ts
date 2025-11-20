import { ContactFinder, ContactSearchCachesRepository } from "../application/ports";
import { ContactResponse } from "../domain/entities/contact";
import { searchContacts } from "../application/searchContacts";
import { Result } from "neverthrow";

export class LlmContactFinder implements ContactFinder {
  constructor(
    private readonly contactSearchCachesRepository: ContactSearchCachesRepository,
  ) {}

  async searchContacts(
    companyName: string,
    domain: string,
    department: string,
  ): Promise<Result<ContactResponse[], Error>> {
    return searchContacts(
      companyName,
      domain,
      department,
      this.contactSearchCachesRepository,
    );
  }
}
