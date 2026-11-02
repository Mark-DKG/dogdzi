import type { ReactNode } from "react";
import { IconAlert, IconRefresh } from "@/components/icons";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-forest-500">{icon}</div>}
      <h3 className="text-base font-bold text-fg">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className }: { title?: string; message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-2xl border border-missed/30 bg-missed-bg/60 px-6 py-10 text-center", className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-missed">
        <IconAlert />
      </div>
      <h3 className="text-base font-bold text-fg">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <IconRefresh size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", children, action, className }: { tone?: "info" | "warn"; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm",
        tone === "warn" ? "border-warn/30 bg-warn-bg text-fg" : "border-line bg-surface-2 text-fg",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}
