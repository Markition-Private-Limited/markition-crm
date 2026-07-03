"use client";

import * as React from "react";
import { getNextStatuses, getStatusList, type WorkflowModule } from "@/src/lib/workflows";

interface WorkflowStatusDropdownProps {
  module: WorkflowModule;
  value?: string;
  currentStatus?: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function WorkflowStatusDropdown({ module, value, currentStatus, onChange, label = "Status", className = "" }: WorkflowStatusDropdownProps) {
  const options = React.useMemo(() => {
    const nextStatuses = currentStatus ? getNextStatuses(module, currentStatus) : [];
    return nextStatuses.length > 0 ? nextStatuses : getStatusList(module);
  }, [currentStatus, module]);

  if (options.length === 0) {
    return (
      <label className={`flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>
        <span>{label}</span>
        <input
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
    );
  }

  return (
    <label className={`flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Select status</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
