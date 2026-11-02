"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element: focus is trapped,
 * Escape closes it and focus returns to the trigger. Renders as a bottom
 * sheet on small screens.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cn(
        "m-0 mt-auto mb-[var(--kb,0px)] max-h-[min(92dvh,calc(var(--vvh,100dvh)-0.5rem))] w-full max-w-none overflow-hidden rounded-t-3xl border border-line bg-surface p-0 text-fg shadow-2xl",
        "sm:m-auto sm:rounded-3xl",
        size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        "open:animate-slide-up",
      )}
    >
      {open && (
        <div className="flex max-h-[min(92dvh,calc(var(--vvh,100dvh)-0.5rem))] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5">
            <div>
              <h2 id="dialog-title" className="text-lg font-bold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <IconX />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 rounded-xl px-4 text-sm font-semibold text-fg hover:bg-surface-2">
            Keep it
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "h-11 rounded-xl px-4 text-sm font-semibold",
              tone === "danger" ? "bg-missed text-cream-50 dark:text-forest-950" : "bg-primary text-primary-fg",
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-muted">{body}</div>
    </Dialog>
  );
}
