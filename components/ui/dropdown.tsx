"use client";

import type { ReactNode } from "react";

interface DropdownProps {
  trigger: ReactNode;
  open: boolean;
  children: ReactNode;
}

export function Dropdown({ trigger, open, children }: DropdownProps) {
  return (
    <div className="relative inline-flex">
      {trigger}
      {open ? <div className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-[18px] border border-border bg-surface p-2 shadow-2xl shadow-black/15">{children}</div> : null}
    </div>
  );
}
