import type {
  Contact,
  ContactId,
  ContactRepository,
} from "@/domain/contact";
import {
  contactIdSchema,
  createContactSchema,
  updateContactSchema,
} from "@/application/contacts/schemas";

export class ContactService {
  constructor(private readonly repository: ContactRepository) {}

  list(): Promise<Contact[]> {
    return this.repository.list();
  }

  async getById(id: string): Promise<Contact | null> {
    const contactId = contactIdSchema.parse(id) as ContactId;
    return this.repository.getById(contactId);
  }

  async create(input: { name: string; email: string; phone: string }) {
    const validated = createContactSchema.parse(input);
    return this.repository.create(validated);
  }

  async update(id: string, input: { name: string; email: string; phone: string }) {
    const contactId = contactIdSchema.parse(id) as ContactId;
    const validated = updateContactSchema.parse(input);
    return this.repository.update(contactId, validated);
  }

  async delete(id: string): Promise<boolean> {
    const contactId = contactIdSchema.parse(id) as ContactId;
    return this.repository.delete(contactId);
  }
}
