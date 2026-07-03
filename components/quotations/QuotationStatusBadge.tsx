"use client";

import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatusBadge";

interface QuotationStatusBadgeProps {
  status?: string;
  archived?: boolean;
}

export function QuotationStatusBadge({ status, archived }: QuotationStatusBadgeProps) {
  return <WorkflowStatusBadge module="quotations" status={status} archived={archived} />;
}
