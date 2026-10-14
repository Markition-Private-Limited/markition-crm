"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityCardProps {
  title: string;
  subtitle: string;
  date: string;
  loading?: boolean;
}

export function ActivityCard({ title, subtitle, date, loading }: ActivityCardProps) {
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <p className="whitespace-nowrap rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">{date}</p>
      </div>
    </Card>
  );
}
