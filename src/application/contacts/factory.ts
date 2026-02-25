import { ContactService } from "@/application/contacts/contact-service";
import { SqliteContactRepository } from "@/persistence/contact-repository";

export function createContactService(): ContactService {
  return new ContactService(new SqliteContactRepository());
}
