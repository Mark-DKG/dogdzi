"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CONSENT_MODE, readConsent, writeConsent } from "@/lib/analytics/client";

/** Asks once whether anonymous usage analytics may run. Never shown in the admin console. */
export function ConsentBanner() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(readConsent() === null);
  }, []);
  if (!show || path?.startsWith("/admin")) return null;

  const decide = (v: boolean) => {
    writeConsent(v);
    setShow(false);
  };

  return (
    <div role="region" aria-label="Privacy choices" className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-xl animate-slide-up rounded-2xl border border-forest-700 bg-forest-900 p-4 text-cream-100 shadow-xl lg:bottom-6">
      <p className="text-sm font-semibold text-cream-200">Help improve DOGDZI?</p>
      <p className="mt-1 text-sm text-forest-200">
        We&apos;d like to count visits, time in the app, and events like &ldquo;action completed&rdquo;. We never collect what your actions say.{" "}
        {CONSENT_MODE === "opt-out" ? "This is on unless you turn it off." : "Nothing is measured unless you allow it."}{" "}
        <Link href="/privacy" className="font-semibold text-cream-200 underline underline-offset-2">
          Privacy notice
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="brand" size="sm" onClick={() => decide(true)}>
          Allow analytics
        </Button>
        <Button variant="ghost" size="sm" className="text-cream-100! hover:bg-forest-800!" onClick={() => decide(false)}>
          No thanks
        </Button>
      </div>
    </div>
  );
}
