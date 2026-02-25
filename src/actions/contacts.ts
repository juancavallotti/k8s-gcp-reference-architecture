"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { createContactService } from "@/application/contacts/factory";

function getRequiredText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing field: ${key}`);
  }
  return value.trim();
}

function handlePersistenceError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("A contact with this email already exists.");
  }

  throw error;
}

export async function listContactsAction() {
  const service = createContactService();
  return service.list();
}

export async function getContactByIdAction(id: string) {
  const service = createContactService();
  return service.getById(id);
}

export async function createContactAction(formData: FormData): Promise<void> {
  const service = createContactService();

  try {
    await service.create({
      name: getRequiredText(formData, "name"),
      email: getRequiredText(formData, "email"),
      phone: getRequiredText(formData, "phone"),
    });
  } catch (error) {
    handlePersistenceError(error);
  }

  revalidatePath("/");
}

export async function updateContactAction(formData: FormData): Promise<void> {
  const id = getRequiredText(formData, "id");
  const service = createContactService();

  try {
    const updated = await service.update(id, {
      name: getRequiredText(formData, "name"),
      email: getRequiredText(formData, "email"),
      phone: getRequiredText(formData, "phone"),
    });

    if (!updated) {
      throw new Error("Contact not found.");
    }
  } catch (error) {
    handlePersistenceError(error);
  }

  revalidatePath("/");
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const id = getRequiredText(formData, "id");
  const service = createContactService();
  await service.delete(id);
  revalidatePath("/");
}
