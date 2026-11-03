"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({ open, title, description, children, onClose, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${sizeMap[size]} rounded-[24px] border border-border bg-surface shadow-2xl shadow-black/30`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-0">
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-snug">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors mt-0.5"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}
