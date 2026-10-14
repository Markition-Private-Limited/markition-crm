"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatisticCardProps {
  title: string;
  value?: string | number;
  icon: ReactNode;
  loading?: boolean;
  href?: string;
}

export function StatisticCard({ title, value, icon, loading, href }: StatisticCardProps) {
  const card = (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <CardBody className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-3 h-8 w-28" />
            ) : (
              <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
            )}
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-surface-muted text-foreground">{icon}</div>
        </div>
      </CardBody>
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
      {card}
    </Link>
  );
}
