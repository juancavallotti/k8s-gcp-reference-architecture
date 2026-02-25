import type {
  Contact,
  ContactId,
  ContactRepository,
  CreateContactInput,
  UpdateContactInput,
} from "@/domain/contact";
import { prisma } from "@/persistence/db/prisma";
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

export class SqliteContactRepository implements ContactRepository {
  async list(): Promise<Contact[]> {
    persistenceLogger.info("list contacts");
    const contacts = await prisma.contact.findMany({
      orderBy: { createdAt: "desc" },
    });
    return contacts.map(mapToDomainContact);
  }

  async getById(id: ContactId): Promise<Contact | null> {
    persistenceLogger.info("get contact by id", { id });
    const contact = await prisma.contact.findUnique({ where: { id } });
    return contact ? mapToDomainContact(contact) : null;
  }

  async create(input: CreateContactInput): Promise<Contact> {
    persistenceLogger.info("create contact", { email: input.email });
    const contact = await prisma.contact.create({
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
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      persistenceLogger.warn("update skipped, contact not found", { id });
      return null;
    }

    const contact = await prisma.contact.update({
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
    const result = await prisma.contact.deleteMany({ where: { id } });
    return result.count > 0;
  }
}
