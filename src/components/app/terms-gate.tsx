"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { updatePreferences } from "@/lib/domain/actions";
import { hasAcceptedCurrentTerms, TERMS_VERSION } from "@/lib/legal/terms";
import { Monogram } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useData } from "./data-provider";

/** "I agree" checkbox with links to the Terms and Privacy Notice (open in a new tab). */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-forest-700)]" />
      <span>
        I&apos;ve read and agree to the{" "}
        <Link href="/terms" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">
          Privacy Notice
        </Link>
        , and I&apos;m 18 or older, or have a parent or guardian&apos;s permission.
      </span>
    </label>
  );
}

/** The preferences patch that records acceptance of the current terms. */
export function acceptTermsChanges(nowIso: string) {
  return { termsVersion: TERMS_VERSION, termsAcceptedAt: nowIso };
}

/**
 * Blocks the app until the current Terms are accepted. Catches people who
 * skipped onboarding, signed in on a new device, or when the terms change.
 */
export function TermsGate() {
  const { status, snapshot, run } = useData();
  const ref = useRef<HTMLDialogElement>(null);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const needed = status === "ready" && !hasAcceptedCurrentTerms(snapshot.preferences.termsVersion);
  const updated = !!snapshot.preferences.termsVersion;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (needed && !d.open) d.showModal();
    if (!needed && d.open) d.close();
  }, [needed]);

  const accept = async () => {
    setSaving(true);
    await run((s, ctx) => updatePreferences(s, acceptTermsChanges(ctx.now.toISOString()), ctx));
    setSaving(false);
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="terms-gate-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-surface p-0 text-fg shadow-2xl"
    >
      {needed && (
        <div className="p-6">
          <Monogram height={20} />
          <h2 id="terms-gate-title" className="mt-5 text-xl font-bold">
            {updated ? "We've updated our Terms" : "Before you continue"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {updated ? "Please review and accept the new Terms of Service to keep using Dogdzi." : "Please review and accept our Terms of Service to use Dogdzi."}
          </p>
          <div className="mt-5">
            <TermsCheckbox checked={agreed} onChange={setAgreed} />
          </div>
          <Button className="mt-5 w-full" size="lg" disabled={!agreed} loading={saving} onClick={() => void accept()}>
            Accept and continue
          </Button>
        </div>
      )}
    </dialog>
  );
}
