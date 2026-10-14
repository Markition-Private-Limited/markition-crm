"use client";

import * as React from "react";

export function Table({ className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-sm shadow-black/5">
      <div className="overflow-x-auto">
        <table className={`min-w-full border-collapse text-sm ${className}`} {...props} />
      </div>
    </div>
  );
}

export function TableHead({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`sticky top-0 z-10 bg-surface-muted ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`border-b border-border/70 last:border-b-0 transition hover:bg-surface-muted ${className}`} {...props} />;
}

export function TableHeader({ className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 align-top text-foreground ${className}`} {...props} />;
}
