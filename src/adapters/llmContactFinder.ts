import { ContactFinder } from "../application/ports";
import { ContactResponse } from "../domain/entities/contact";
import { searchContacts } from "../application/searchContacts";

export class LlmContactFinder implements ContactFinder {
  async searchContacts(
    companyName: string,
    domain: string,
    department: string,
  ): Promise<ContactResponse[]> {
    return searchContacts(companyName, domain, department);
  }
}
