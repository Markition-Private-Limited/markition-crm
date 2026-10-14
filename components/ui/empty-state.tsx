"use client";

import Link from "next/link";
import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-surface-muted px-6 py-10 text-center">
      <div className="max-w-md">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Button className="mt-5" href={actionHref}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
