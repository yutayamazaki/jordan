import { ContactFinder, ContactSearchCachesRepository } from "../application/ports";
import { ContactResponse } from "../domain/entities/contact";
import { searchContacts } from "../application/searchContacts";

export class LlmContactFinder implements ContactFinder {
  constructor(
    private readonly contactSearchCachesRepository: ContactSearchCachesRepository,
  ) {}

  async searchContacts(
    companyName: string,
    domain: string,
    department: string,
  ): Promise<ContactResponse[]> {
    return searchContacts(
      companyName,
      domain,
      department,
      this.contactSearchCachesRepository,
    );
  }
}
