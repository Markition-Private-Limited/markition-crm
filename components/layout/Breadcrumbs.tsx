"use client";

import Link from "next/link";

interface BreadcrumbsProps {
  items: Array<{ label: string; href?: string; current?: boolean }>;
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href && !item.current ? (
              <Link href={item.href} className="transition hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{item.label}</span>
            )}
            {index < items.length - 1 ? <span className="text-border">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
