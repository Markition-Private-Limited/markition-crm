"use client";

import { Badge } from "@/components/ui/badge";
import { getWorkflowStatusLabel, getWorkflowStatusTone } from "@/src/lib/workflows";
import type { WorkflowModule, WorkflowTone } from "@/src/lib/workflows";

interface WorkflowStatusBadgeProps {
  module: WorkflowModule;
  status?: string;
  archived?: boolean;
  className?: string;
}

function toneToClassName(tone: WorkflowTone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
    case "info":
      return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200";
    case "accent":
      return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200";
    case "muted":
      return "border-slate-200 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100";
    case "default":
    default:
      return "border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
  }
}

export function WorkflowStatusBadge({ module, status, archived, className = "" }: WorkflowStatusBadgeProps) {
  if (archived) {
    return <Badge variant="outline" className={`border-slate-200 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100 ${className}`}>Archived</Badge>;
  }

  const label = getWorkflowStatusLabel(module, status);
  const tone = getWorkflowStatusTone(module, status);

  return (
    <Badge variant="outline" className={`${toneToClassName(tone)} ${className}`}>
      {label}
    </Badge>
  );
}
