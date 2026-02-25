export type ContactId = string;

export interface Contact {
  id: ContactId;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  name: string;
  email: string;
  phone: string;
}

export interface UpdateContactInput {
  name: string;
  email: string;
  phone: string;
}

export interface ContactRepository {
  list(): Promise<Contact[]>;
  getById(id: ContactId): Promise<Contact | null>;
  create(input: CreateContactInput): Promise<Contact>;
  update(id: ContactId, input: UpdateContactInput): Promise<Contact | null>;
  delete(id: ContactId): Promise<boolean>;
}
