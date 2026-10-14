"use client";

import type { ReactNode } from "react";

interface ToolbarProps {
  children: ReactNode;
}

export function Toolbar({ children }: ToolbarProps) {
  return <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3 shadow-sm shadow-black/5">{children}</div>;
}
