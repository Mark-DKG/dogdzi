"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ServerAction = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** Form bound to an admin server action, with inline success/error feedback. */
export function AdminForm({ action, children, className }: { action: ServerAction; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      {children}
      {state && (
        <p role={state.ok ? "status" : "alert"} className={cn("text-sm font-medium", state.ok ? "text-done" : "text-missed")}>
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({ children, variant = "primary", size = "sm" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending}>
      {children}
    </Button>
  );
}

export function PendingButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" loading={pending}>
      {children}
    </Button>
  );
}
