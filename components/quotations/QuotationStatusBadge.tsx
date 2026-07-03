"use client";

import { Badge } from "@/components/ui/badge";
import type { QuotationStatus } from "@/src/modules/quotations/quotation-types";

const STATUS_STYLES: Record<QuotationStatus | "Archived", { label: string; className: string; variant: "default" | "accent" | "outline" }> = {
  Draft: { label: "Draft", className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100", variant: "outline" },
  Sent: { label: "Sent", className: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", variant: "outline" },
  Viewed: { label: "Viewed", className: "bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", variant: "outline" },
  Accepted: { label: "Accepted", className: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", variant: "outline" },
  Rejected: { label: "Rejected", className: "bg-rose-500/15 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", variant: "outline" },
  Expired: { label: "Expired", className: "bg-amber-500/15 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", variant: "outline" },
  Archived: { label: "Archived", className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100", variant: "outline" },
};

interface QuotationStatusBadgeProps {
  status?: string;
  archived?: boolean;
}

export function QuotationStatusBadge({ status, archived }: QuotationStatusBadgeProps) {
  const key = archived ? "Archived" : ((status as QuotationStatus) ?? "Draft");
  const styles = STATUS_STYLES[key] ?? STATUS_STYLES.Draft;

  return <Badge variant={styles.variant} className={styles.className}>{styles.label}</Badge>;
}
