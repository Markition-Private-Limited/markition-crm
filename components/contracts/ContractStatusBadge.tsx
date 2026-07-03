"use client";

import { Badge } from "@/components/ui/badge";
import type { ContractStatus } from "@/src/modules/contracts/contract-types";

const STATUS_STYLES: Record<ContractStatus | "Archived", { label: string; className: string }> = {
  Draft: { label: "Draft", className: "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" },
  "Under Review": { label: "Under Review", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" },
  "Pending Signature": { label: "Pending Signature", className: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200" },
  Active: { label: "Active", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" },
  Completed: { label: "Completed", className: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200" },
  Expired: { label: "Expired", className: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" },
  Terminated: { label: "Terminated", className: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" },
  Renewed: { label: "Renewed", className: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200" },
  Archived: { label: "Archived", className: "border-slate-200 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100" },
};

interface ContractStatusBadgeProps {
  status?: string;
  archived?: boolean;
}

export function ContractStatusBadge({ status, archived }: ContractStatusBadgeProps) {
  const key = archived ? "Archived" : ((status as ContractStatus) ?? "Draft");
  const styles = STATUS_STYLES[key] ?? STATUS_STYLES.Draft;

  return <Badge variant="outline" className={styles.className}>{styles.label}</Badge>;
}
