"use client";
import * as React from "react";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  imageSrc?: string;
}

export function Avatar({ name, imageSrc, className = "", ...props }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-sm font-semibold uppercase text-foreground shadow-sm shadow-black/5 ${className}`}
      {...props}
    >
      {imageSrc ? <img src={imageSrc} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
