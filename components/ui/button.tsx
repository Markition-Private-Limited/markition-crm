"use client";
import * as React from "react";
import Link from "next/link";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "icon";
  size?: "sm" | "md" | "lg" | "icon";
  href?: string;
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  href,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-[16px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-surface-muted text-foreground hover:bg-surface-elevated",
    ghost: "bg-transparent text-foreground hover:bg-surface-muted",
    icon: "bg-transparent p-2 text-foreground hover:bg-surface-muted"
  };

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "h-10 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
    icon: "h-10 w-10 p-0"
  };

  const sharedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return <Link className={sharedClassName} href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }

  return <button className={sharedClassName} {...props} />;
}
