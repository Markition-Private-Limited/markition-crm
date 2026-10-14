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

export const projectStatuses = ["Planned", "In Progress", "On Hold", "Completed", "Cancelled"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const PROJECT_STATUSES = [...projectStatuses] as const;

// Schema matches actual DB columns: name, company_id, status, start_date, end_date, budget, description
export const projectSchema = z.object({
  name: z.string().min(2, "Project name is required").max(140, "Project name is too long"),
  company_id: optionalString(80),
  status: z.enum(projectStatuses),
  start_date: optionalString(10),
  end_date: optionalString(10),
  budget: optionalNumber().refine((value) => value === undefined || value >= 0, "Budget must be 0 or greater"),
  description: optionalString(4000),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export type Project = {
  id: string;
  name: string;
  company_id?: string;
  owner_id?: string;
  deal_id?: string;
  status?: ProjectStatus | string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  progress?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export function defaultProjectDraft(): ProjectFormValues {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);

  const dateValue = (date: Date) => date.toISOString().slice(0, 10);

  return {
    name: "",
    company_id: undefined,
    status: "Planned",
    start_date: dateValue(today),
    end_date: dateValue(due),
    budget: undefined,
    description: undefined,
  };
}

export function formatProjectDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatMoney(amount?: number, currency = "USD") {
  if (typeof amount !== "number") return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
