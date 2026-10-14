"use client";

import type { ReactNode } from "react";

interface TabsProps {
  items: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}

export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-[18px] border border-border bg-surface-muted p-1">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`rounded-[14px] px-3 py-2 text-sm font-medium transition ${active ? "bg-surface text-foreground shadow-sm shadow-black/5" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
