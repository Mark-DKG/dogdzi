"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { recordConsoleSignIn } from "@/app/admin/actions";
import { Monogram } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { getBrowserSupabase } from "@/lib/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "verify"; factorId: string };

/** Second factor for admins: enrol an authenticator app once, then verify a 6-digit code each sign-in. */
export default function AdminMfaPage() {
  const router = useRouter();
  const sb = getBrowserSupabase();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sb) return setState({ kind: "error", message: "Supabase isn't configured." });
    (async () => {
      const { data: user } = await sb.auth.getUser();
      if (!user.user) return router.replace("/admin/signin");
      const { data, error: err } = await sb.auth.mfa.listFactors();
      if (err) return setState({ kind: "error", message: "Couldn't check your authenticator settings." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setState({ kind: "verify", factorId: verified.id });
      // Clean up abandoned enrolments, then start a new one.
      for (const f of data.all.filter((x) => x.status === "unverified")) await sb.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrol, error: enrolErr } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `DOGDZI admin ${new Date().toISOString().slice(0, 10)}` });
      if (enrolErr || !enrol) return setState({ kind: "error", message: "Couldn't start authenticator setup. Is MFA enabled in Supabase Auth?" });
      setState({ kind: "enroll", factorId: enrol.id, qr: enrol.totp.qr_code, secret: enrol.totp.secret });
    })();
  }, [sb, router, attempt]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "enroll" && state.kind !== "verify") return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    setBusy(true);
    setError(null);
    const { error: err } = await sb!.auth.mfa.challengeAndVerify({ factorId: state.factorId, code });
    if (err) {
      setBusy(false);
      setCode("");
      return setError("That code didn't work. Codes change every 30 seconds, so try the current one.");
    }
    await recordConsoleSignIn().catch(() => {});
    router.replace("/admin");
    router.refresh();
  };

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-forest-950 px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Monogram height={20} />
          <h1 className="text-lg font-bold">Two-step verification</h1>
        </div>
        {state.kind === "loading" && (
          <div role="status" aria-busy="true" className="space-y-3">
            <span className="sr-only">Loading</span>
            <Skeleton className="mx-auto h-44 w-44" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
        {state.kind === "error" && <ErrorState message={state.message} onRetry={() => setAttempt((a) => a + 1)} />}
        {(state.kind === "enroll" || state.kind === "verify") && (
          <form onSubmit={verify} className="space-y-4">
            {state.kind === "enroll" ? (
              <>
                <p className="text-sm text-muted">Admin access requires an authenticator app (Google Authenticator, 1Password, Authy…). Scan this code, then enter the 6-digit code it shows.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.qr} alt="QR code for your authenticator app" width={176} height={176} className="mx-auto rounded-xl bg-white p-2" />
                <p className="break-all text-center font-mono text-xs text-muted">{state.secret}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Enter the 6-digit code from your authenticator app.</p>
            )}
            {error && (
              <p role="alert" className="text-sm font-medium text-missed">
                {error}
              </p>
            )}
            <Field label="Code">
              {({ id }) => (
                <Input id={id} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono text-lg tracking-[0.4em]" autoFocus />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Verify
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
