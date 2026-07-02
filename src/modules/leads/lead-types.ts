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

const optionalNumber = () =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }, z.number().optional());

const optionalDate = () =>
  z.preprocess(trimEmptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").optional());

export const leadSchema = z.object({
  title: z.string().min(2, "Lead title is required").max(140, "Lead title is too long"),
  company_id: optionalString(80),
  contact_id: optionalString(80),
  assigned_salesperson: optionalString(120),
  source: optionalString(100),
  stage: optionalString(60),
  priority: optionalString(30),
  expected_revenue: optionalNumber(),
  probability: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return value;
    }
    return parsed;
  }, z.number().min(0, "Probability must be at least 0").max(100, "Probability must be at most 100").optional()),
  next_follow_up_date: optionalDate(),
  notes: optionalString(3000),
  tags: optionalString(500)
});

export type Lead = {
  id: string;
  title?: string;
  name?: string;
  company_id?: string;
  contact_id?: string;
  assigned_salesperson?: string;
  source?: string;
  stage?: string;
  priority?: string;
  expected_revenue?: number;
  probability?: number;
  next_follow_up_date?: string;
  notes?: string;
  tags?: string | string[];
  created_at?: string;
  updated_at?: string;
};

export type LeadFormValues = z.infer<typeof leadSchema>;

export const LEAD_STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost"
] as const;

export const LEAD_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "LinkedIn",
  "Email Campaign",
  "Paid Ads",
  "Event",
  "Direct"
] as const;
