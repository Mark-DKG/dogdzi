"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { IconX } from "@/components/icons";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: Tone;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show(message: string, tone?: Tone, action?: Toast["action"]): void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<ToastApi["show"]>(
    (message, tone = "info", action) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, tone, message, action }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 lg:top-auto lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-md animate-slide-up items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg",
              t.tone === "error" ? "bg-missed text-cream-50 dark:text-forest-950" : "bg-forest-900 text-cream-200",
            )}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="rounded-lg px-2 py-1 font-bold underline-offset-2 hover:underline"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-lg opacity-80 hover:opacity-100">
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
