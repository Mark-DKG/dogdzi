"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconMore } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

/** Small overflow menu. Arrow keys move between items, Escape closes. */
export function Menu({ items, label = "More options", triggerClassName, icon }: { items: MenuItem[]; label?: string; triggerClassName?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus();
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const els = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
      const i = els.indexOf(document.activeElement as HTMLButtonElement);
      els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
    }
  };

  return (
    <div ref={ref} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg", triggerClassName)}
      >
        {icon ?? <IconMore />}
      </button>
      {open && (
        <div id={id} role="menu" className="absolute right-0 z-30 mt-1 min-w-48 animate-fade-in overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none disabled:opacity-40",
                it.tone === "danger" ? "text-missed" : "text-fg",
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
