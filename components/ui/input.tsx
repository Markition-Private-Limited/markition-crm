"use client";
import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ className = "", label, ...props }: InputProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm font-medium text-foreground">
      {label ? <span>{label}</span> : null}
      {(() => {
        const { error, ...inputProps } = props as InputProps;
        return (
          <>
            <input
              className={`h-10 w-full rounded-[16px] border border-border bg-surface px-4 text-foreground placeholder:text-muted-foreground shadow-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
              {...inputProps}
            />
            {error ? <span className="text-xs text-danger">{error}</span> : null}
          </>
        );
      })()}
    </label>
  );
}
