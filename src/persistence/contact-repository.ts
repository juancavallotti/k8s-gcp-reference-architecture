import type {
  Contact,
  ContactId,
  ContactRepository,
  CreateContactInput,
  UpdateContactInput,
} from "@/domain/contact";
import { db } from "@/persistence/db/client";
import { persistenceLogger } from "@/persistence/logger";

function mapToDomainContact(contact: {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}): Contact {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

export class PrismaContactRepository implements ContactRepository {
  async list(): Promise<Contact[]> {
    persistenceLogger.info("list contacts");
    const contacts = await db.contact.findMany({
      orderBy: { createdAt: "desc" },
    });
    return contacts.map(mapToDomainContact);
  }

  async getById(id: ContactId): Promise<Contact | null> {
    persistenceLogger.info("get contact by id", { id });
    const contact = await db.contact.findUnique({ where: { id } });
    return contact ? mapToDomainContact(contact) : null;
  }

  async create(input: CreateContactInput): Promise<Contact> {
    persistenceLogger.info("create contact", { email: input.email });
    const contact = await db.contact.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
      },
    });
    return mapToDomainContact(contact);
  }

  async update(id: ContactId, input: UpdateContactInput): Promise<Contact | null> {
    persistenceLogger.info("update contact", { id });
    const existing = await db.contact.findUnique({ where: { id } });
    if (!existing) {
      persistenceLogger.warn("update skipped, contact not found", { id });
      return null;
    }

    const contact = await db.contact.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
      },
    });

    return mapToDomainContact(contact);
  }

  async delete(id: ContactId): Promise<boolean> {
    persistenceLogger.info("delete contact", { id });
    const result = await db.contact.deleteMany({ where: { id } });
    return result.count > 0;
  }
}

export { PrismaContactRepository as SqliteContactRepository };
