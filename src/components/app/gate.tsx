"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { IconLock } from "@/components/icons";
import { LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import { useData } from "./data-provider";

/** Shows a skeleton while loading, an error with retry on failure, and the content when ready. */
export function DataGate({ skeleton, children }: { skeleton: ReactNode; children: () => ReactNode }) {
  const { status, error, retry } = useData();
  if (status === "loading") return <>{skeleton}</>;
  if (status === "error") return <ErrorState title="Couldn't load your data" message={error ?? "Please try again."} onRetry={retry} />;
  return <>{children()}</>;
}

/** Shown when a guest reaches a limit. Offers sign-up without blocking the rest of the app. */
export function UpgradeDialog() {
  const { upgrade, dismissUpgrade, accountsAvailable } = useData();
  return (
    <Dialog
      open={!!upgrade}
      onClose={dismissUpgrade}
      title="Available with a free account"
      footer={
        accountsAvailable ? (
          <>
            <LinkButton href="/signin" variant="ghost" onClick={dismissUpgrade}>
              Sign in
            </LinkButton>
            <LinkButton href="/signup" onClick={dismissUpgrade}>
              Create free account
            </LinkButton>
          </>
        ) : undefined
      }
    >
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-forest-500">
          <IconLock />
        </div>
        <div className="space-y-2 text-sm">
          <p className="text-fg">{upgrade?.reason}</p>
          {accountsAvailable ? (
            <p className="text-muted">Everything you&apos;ve added as a guest moves into your account when you sign up.</p>
          ) : (
            <p className="text-muted">Accounts aren&apos;t enabled on this server yet.</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function LockedPanel({ title, body }: { title: string; body: string }) {
  const { accountsAvailable } = useData();
  return (
    <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-900 text-cream-200">
        <IconLock />
      </div>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
      {accountsAvailable && (
        <div className="mt-5 flex gap-2">
          <LinkButton href="/signup">Create free account</LinkButton>
          <Link href="/signin" className="inline-flex h-11 items-center px-3 text-sm font-semibold text-fg underline-offset-2 hover:underline">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
