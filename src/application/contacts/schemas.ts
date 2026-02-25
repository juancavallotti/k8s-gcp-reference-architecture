import { z } from "zod";

export const contactIdSchema = z.uuid();

export const createContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: z.email("Email is invalid").max(255, "Email is too long"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .max(50, "Phone is too long"),
});

export const updateContactSchema = createContactSchema;

export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
