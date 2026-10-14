"use client";
import { Button } from "@/components/ui/button";
interface WorkflowTransitionConfirmationModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}
export function WorkflowTransitionConfirmationModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: WorkflowTransitionConfirmationModalProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/60 p-4 backdrop-blur-sm">
      {" "}
      <div className="w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-2xl ">
        {" "}
        <h2 className="text-xl font-semibold text-foreground ">{title}</h2>{" "}
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground ">{description}</p>
        ) : null}{" "}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {" "}
          <Button type="button" variant="secondary" onClick={onCancel}>
            {" "}
            {cancelLabel}{" "}
          </Button>{" "}
          <Button
            type="button"
            onClick={onConfirm}
            className={
              tone === "danger" ? "bg-danger/10 hover:bg-danger/10" : undefined
            }
          >
            {" "}
            {confirmLabel}{" "}
          </Button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
