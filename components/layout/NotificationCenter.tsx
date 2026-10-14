"use client";

import { Bell, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const notifications = [
  {
    title: "New client added",
    description: "A new client record was added to the pipeline.",
    variant: "success"
  },
  {
    title: "Quotation pending review",
    description: "Quotation #QT-947 needs approval before sending.",
    variant: "info"
  },
  {
    title: "Overdue invoice",
    description: "Invoice #INV-403 is overdue by 2 days.",
    variant: "warning"
  }
];

function getIcon(variant: string) {
  if (variant === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (variant === "warning") return <XCircle className="h-4 w-4 text-amber-500" />;
  return <Loader2 className="h-4 w-4 text-sky-500" />;
}

export function NotificationCenter() {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-4 shadow-sm shadow-black/5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Activity feed</p>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Recent</span>
      </div>
      <div className="space-y-3">
        {notifications.map((item) => (
          <div key={item.title} className="flex items-start gap-3 rounded-[18px] border border-border bg-surface-muted p-4">
            <div className="mt-1">{getIcon(item.variant)}</div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
