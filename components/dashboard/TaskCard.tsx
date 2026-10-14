"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskCardProps {
  title: string;
  dueDate: string;
  stage: string;
  loading?: boolean;
}

export function TaskCard({ title, dueDate, stage, loading }: TaskCardProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </Card>
    );
  }

  return (
    <Card className="p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-2 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">{stage}</span>
      </div>
      <p className="text-sm text-muted-foreground">Due {dueDate}</p>
    </Card>
  );
}
