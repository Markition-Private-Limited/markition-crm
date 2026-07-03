"use client";

import { WorkflowStatusBadge } from "@/components/workflow/WorkflowStatusBadge";

interface ContractStatusBadgeProps {
  status?: string;
  archived?: boolean;
}

export function ContractStatusBadge({ status, archived }: ContractStatusBadgeProps) {
  return <WorkflowStatusBadge module="contracts" status={status} archived={archived} />;
}
