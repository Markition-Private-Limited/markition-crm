"use client";
import { Badge } from "@/components/ui/badge";
import {
  getWorkflowStatusLabel,
  getWorkflowStatusTone,
} from "@/src/lib/workflows";
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
      return "border-success/30 bg-success/10 text-success ";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning ";
    case "danger":
      return "border-danger/30 bg-danger/10 text-danger ";
    case "info":
      return "border-accent/30 bg-accent/10 text-accent ";
    case "accent":
      return "border-accent/30 bg-accent/10 text-accent ";
    case "muted":
      return "border-border bg-surface-muted text-muted-foreground ";
    case "default":
    default:
      return "border-border bg-surface-elevated text-muted-foreground ";
  }
}
export function WorkflowStatusBadge({
  module,
  status,
  archived,
  className = "",
}: WorkflowStatusBadgeProps) {
  if (archived) {
    return (
      <Badge
        variant="outline"
        className={`border-border bg-surface-muted text-muted-foreground ${className}`}
      >
        Archived
      </Badge>
    );
  }
  const label = getWorkflowStatusLabel(module, status);
  const tone = getWorkflowStatusTone(module, status);
  return (
    <Badge
      variant="outline"
      className={`${toneToClassName(tone)} ${className}`}
    >
      {" "}
      {label}{" "}
    </Badge>
  );
}
