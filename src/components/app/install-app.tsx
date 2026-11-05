"use client";

import { useEffect, useState } from "react";
import { IconDevice, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { currentInstallMethod, onInstallChange, promptInstall, runtimeOS, type InstallMethod } from "@/lib/platform";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "dogdzi:install-dismissed";

export function useInstallMethod(): InstallMethod | null {
  const [method, setMethod] = useState<InstallMethod | null>(null);
  useEffect(() => {
    const sync = () => setMethod(currentInstallMethod());
    sync();
    return onInstallChange(sync);
  }, []);
  return method;
}

/** Share icon as it appears in Safari, so the instruction is easy to follow. */
export function ShareGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="inline-block -translate-y-0.5">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function Steps({ method }: { method: InstallMethod }) {
  switch (method) {
    case "ios-safari":
      return (
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Tap <b>Share</b> <ShareGlyph /> in Safari&apos;s toolbar.
          </li>
          <li>
            Choose <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
        </ol>
      );
    case "ios-other":
      return (
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Open your browser&apos;s <b>Share</b> menu <ShareGlyph /> and choose <b>Add to Home Screen</b>.
          </li>
          <li>
            If you don&apos;t see it, open <b>dogdzi.vercel.app</b> in <b>Safari</b> and add it from there.
          </li>
        </ol>
      );
    case "android-menu":
      return (
        <p>
          Open your browser menu (<b>⋮</b>) and choose <b>Install app</b> or <b>Add to Home screen</b>.
        </p>
      );
    case "desktop-menu":
      return (
        <p>
          Click the <b>install icon</b> in the address bar, or open the browser menu and choose <b>Install Dogdzi</b>.
        </p>
      );
    case "unsupported":
      return <p>This browser can&apos;t install web apps. Try Chrome, Edge or Safari.</p>;
    default:
      return null;
  }
}

/** Install section for Settings: always shows the right method for this device. */
export function InstallCard() {
  const method = useInstallMethod();
  const [busy, setBusy] = useState(false);
  if (!method) return null;
  if (method === "installed") return <p className="text-sm text-muted">Dogdzi is installed on this device and opens in its own window.</p>;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">Install Dogdzi to open it from your home screen, full-screen, like a regular app.</p>
      {method === "prompt" ? (
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await promptInstall();
            setBusy(false);
          }}
        >
          <IconDevice size={18} /> Install Dogdzi
        </Button>
      ) : (
        <div className="rounded-xl bg-surface-2 p-4 text-fg">
          <Steps method={method} />
        </div>
      )}
    </div>
  );
}

/** One-time, dismissible suggestion on phones and tablets that aren't running the installed app. */
export function InstallBanner() {
  const method = useInstallMethod();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setHidden(true);
    }
  }, []);
  const mobile = typeof navigator !== "undefined" && runtimeOS() !== "other";
  if (hidden || !method || !mobile || method === "installed" || method === "unsupported" || method === "desktop-menu") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm" role="region" aria-label="Install Dogdzi">
      <IconDevice size={20} className="mt-0.5 shrink-0 text-forest-500" />
      <div className={cn("min-w-0 flex-1 space-y-2")}>
        <p className="font-semibold text-fg">Add Dogdzi to your home screen</p>
        {method === "prompt" ? (
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await promptInstall();
              setBusy(false);
              if (ok) dismiss();
            }}
          >
            Install
          </Button>
        ) : (
          <div className="text-muted">
            <Steps method={method} />
          </div>
        )}
      </div>
      <button type="button" onClick={dismiss} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Dismiss install suggestion">
        <IconX size={18} />
      </button>
    </div>
  );
}
