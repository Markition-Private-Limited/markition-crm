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

const optionalDate = () =>
  z.preprocess(trimEmptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").optional());

export const QUOTATION_STATUSES = ["Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export type QuotationLineItem = {
  item_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
};

export type QuotationLineItemDraft = {
  item_name: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax: string;
};

export type QuotationDraftValues = {
  quotation_number: string;
  client_company_id?: string;
  contact_id?: string;
  sales_representative?: string;
  currency: string;
  quotation_date: string;
  expiry_date?: string;
  reference_number?: string;
  status: QuotationStatus;
  line_items: QuotationLineItemDraft[];
  notes?: string;
  internal_notes?: string;
  terms_and_conditions?: string;
  attachments?: string;
};

export const quotationLineItemSchema = z.object({
  item_name: z.string().min(2, "Service or product is required").max(140, "Item name is too long"),
  description: optionalString(500),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit_price: z.coerce.number().min(0, "Unit price must be 0 or greater"),
  discount: z.coerce.number().min(0, "Discount must be 0 or greater").max(100, "Discount must be 100 or less"),
  tax: z.coerce.number().min(0, "Tax must be 0 or greater").max(100, "Tax must be 100 or less"),
});

export const quotationSchema = z.object({
  quotation_number: z.string().min(3, "Quotation number is required").max(40, "Quotation number is too long"),
  client_company_id: optionalString(80),
  contact_id: optionalString(80),
  sales_representative: optionalString(120),
  currency: z.string().min(3, "Currency is required").max(10, "Currency is too long"),
  quotation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  expiry_date: optionalDate(),
  reference_number: optionalString(80),
  status: z.enum(QUOTATION_STATUSES),
  line_items: z.array(quotationLineItemSchema).min(1, "Add at least one line item"),
  notes: optionalString(5000),
  internal_notes: optionalString(5000),
  terms_and_conditions: optionalString(5000),
  attachments: optionalString(5000),
});

export type QuotationFormValues = z.infer<typeof quotationSchema>;

export type QuotationActivityEntry = {
  label: string;
  detail?: string;
  at: string;
  tone?: "default" | "success" | "warning" | "muted";
};

export type Quotation = {
  id: string;
  quotation_number?: string;
  client_company_id?: string;
  contact_id?: string;
  sales_representative?: string;
  currency?: string;
  quotation_date?: string;
  expiry_date?: string;
  reference_number?: string;
  status?: QuotationStatus | string;
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  grand_total?: number;
  notes?: string;
  internal_notes?: string;
  terms_and_conditions?: string;
  attachments?: string | string[];
  line_items?: QuotationLineItem[] | string;
  activity_log?: QuotationActivityEntry[] | string;
  timeline?: QuotationActivityEntry[] | string;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
};

export function generateQuotationNumber() {
  const stamp = new Date();
  const datePart = stamp.toISOString().slice(0, 10).replaceAll("-", "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `Q-${datePart}-${randomPart}`;
}

export function emptyQuotationDraft(): QuotationDraftValues {
  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 14);

  return {
    quotation_number: generateQuotationNumber(),
    client_company_id: undefined,
    contact_id: undefined,
    sales_representative: undefined,
    currency: "USD",
    quotation_date: today,
    expiry_date: expiry.toISOString().slice(0, 10),
    reference_number: undefined,
    status: "Draft",
    line_items: [emptyQuotationLineItem()],
    notes: undefined,
    internal_notes: undefined,
    terms_and_conditions: undefined,
    attachments: undefined,
  };
}

export function emptyQuotationLineItem(): QuotationLineItemDraft {
  return {
    item_name: "",
    description: "",
    quantity: "1",
    unit_price: "0",
    discount: "0",
    tax: "0",
  };
}

export function quotationToDraft(quotation?: Quotation, duplicate = false): QuotationDraftValues {
  if (!quotation) {
    return emptyQuotationDraft();
  }

  const sourceLineItems = Array.isArray(quotation.line_items)
    ? quotation.line_items
    : (() => {
        try {
          return JSON.parse(quotation.line_items ?? "[]") as QuotationLineItem[];
        } catch {
          return [];
        }
      })();

  return {
    quotation_number: duplicate ? generateQuotationNumber() : quotation.quotation_number ?? generateQuotationNumber(),
    client_company_id: quotation.client_company_id,
    contact_id: quotation.contact_id,
    sales_representative: quotation.sales_representative,
    currency: quotation.currency ?? "USD",
    quotation_date: quotation.quotation_date ?? new Date().toISOString().slice(0, 10),
    expiry_date: quotation.expiry_date,
    reference_number: quotation.reference_number,
    status: duplicate ? "Draft" : (quotation.status as QuotationStatus) ?? "Draft",
    line_items: sourceLineItems.length > 0
      ? sourceLineItems.map((item) => ({
          item_name: item.item_name,
          description: item.description ?? "",
          quantity: String(item.quantity ?? 1),
          unit_price: String(item.unit_price ?? 0),
          discount: String(item.discount ?? 0),
          tax: String(item.tax ?? 0),
        }))
      : [emptyQuotationLineItem()],
    notes: quotation.notes,
    internal_notes: quotation.internal_notes,
    terms_and_conditions: quotation.terms_and_conditions,
    attachments: Array.isArray(quotation.attachments) ? quotation.attachments.join("\n") : quotation.attachments,
  };
}

export function parseTextList(value?: string | string[]) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateQuotationSummary(lineItems: Array<QuotationLineItemDraft | QuotationLineItem>) {
  const subtotal = lineItems.reduce((sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_price), 0);
  const discountTotal = lineItems.reduce((sum, item) => {
    const base = toNumber(item.quantity) * toNumber(item.unit_price);
    return sum + base * (toNumber(item.discount) / 100);
  }, 0);
  const taxableBase = subtotal - discountTotal;
  const taxTotal = lineItems.reduce((sum, item) => {
    const base = toNumber(item.quantity) * toNumber(item.unit_price);
    const discount = base * (toNumber(item.discount) / 100);
    return sum + (base - discount) * (toNumber(item.tax) / 100);
  }, 0);
  const grandTotal = subtotal - discountTotal + taxTotal;

  return {
    subtotal: roundMoney(subtotal),
    discountTotal: roundMoney(discountTotal),
    taxTotal: roundMoney(taxTotal),
    grandTotal: roundMoney(grandTotal),
    taxableBase: roundMoney(taxableBase),
  };
}

export function calculateLineItemTotal(item: QuotationLineItemDraft | QuotationLineItem) {
  const base = toNumber(item.quantity) * toNumber(item.unit_price);
  const discounted = base - base * (toNumber(item.discount) / 100);
  const taxed = discounted + discounted * (toNumber(item.tax) / 100);
  return roundMoney(taxed);
}

export function formatCurrency(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatQuotationDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
