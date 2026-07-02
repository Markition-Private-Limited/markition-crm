import { z } from "zod";

const trimEmptyToUndefined = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
};

const optionalString = (maxLength = 255) =>
  z.preprocess(trimEmptyToUndefined, z.string().max(maxLength).optional());

export const contactSchema = z.object({
  name: z.string().min(2, "Contact name is required").max(120, "Contact name is too long"),
  email: z.preprocess(trimEmptyToUndefined, z.string().email("Enter a valid email").optional()),
  phone: optionalString(50),
  position: optionalString(100),
  status: optionalString(50),
  company_id: optionalString(80),
  notes: optionalString(2000)
});

export type Contact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  status?: string;
  company_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type ContactFormValues = z.infer<typeof contactSchema>;
