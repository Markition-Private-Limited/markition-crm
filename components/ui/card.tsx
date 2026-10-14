"use client";

import * as React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "subtle" | "raised";
}

export function Card({ className = "", tone = "default", ...props }: CardProps) {
  const toneStyles: Record<NonNullable<CardProps["tone"]>, string> = {
    default: "bg-surface border-border shadow-sm shadow-black/5",
    subtle: "bg-surface-muted border-border shadow-none",
    raised: "bg-surface border-border shadow-lg shadow-black/10",
  };

  return <div className={`rounded-[20px] border ${toneStyles[tone]} ${className}`} {...props} />;
}

export function CardHeader({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-start justify-between gap-4 p-5 pb-4 ${className}`} {...props} />;
}

export function CardBody({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-5 pb-5 ${className}`} {...props} />;
}

export function CardFooter({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-t border-border px-5 py-4 ${className}`} {...props} />;
}
