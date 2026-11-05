"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { recordConsoleSignIn } from "@/app/admin/actions";
import { Monogram } from "@/components/brand/logo";
import { IconShield } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Skeleton } from "@/components/ui/skeleton";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function AdminSignInPage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-forest-950 px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Monogram height={20} />
          <div>
            <p className="text-sm font-bold tracking-wide text-muted">Dogdzi</p>
            <h1 className="text-lg font-bold">Admin console</h1>
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <Form />
        </Suspense>
        <p className="mt-6 flex items-start gap-2 text-xs text-muted">
          <IconShield size={14} className="mt-0.5 shrink-0" /> Staff accounts only. Every sign-in and access is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") === "no_access" ? "This account doesn't have admin access, or it has been disabled." : null);

  if (!sb) return <p className="text-sm text-muted">Supabase isn&apos;t configured on this server, so the admin console is unavailable.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setBusy(false);
      return setError("Those details don't match an account.");
    }
    await recordConsoleSignIn().catch(() => {});
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="space-y-2 rounded-xl bg-missed-bg px-3.5 py-2.5 text-sm font-medium text-missed">
          <p>{error}</p>
          {params.get("error") === "no_access" && (
            <button type="button" className="text-xs underline" onClick={() => void sb.auth.signOut().then(() => router.replace("/admin/signin"))}>
              Sign out of this account
            </button>
          )}
        </div>
      )}
      <Field label="Work email">{({ id }) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
      <Field label="Password">{({ id }) => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Continue
      </Button>
    </form>
  );
}
