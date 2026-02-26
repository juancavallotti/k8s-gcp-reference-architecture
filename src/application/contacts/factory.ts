import { ContactService } from "@/application/contacts/contact-service";
import { PrismaContactRepository } from "@/persistence/contact-repository";

export function createContactService(): ContactService {
  return new ContactService(new PrismaContactRepository());
}
