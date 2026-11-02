"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics/client";
import { FIRST_NAME_MAX, normalizeFirstName } from "@/lib/domain/names";
import { hasGuestData, readGuestSnapshot } from "@/lib/store/local-repo";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Notice } from "@/components/ui/states";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NotConfigured() {
  return (
    <Notice tone="warn">
      Accounts aren&apos;t enabled on this server yet. You can still{" "}
      <Link href="/app" className="font-semibold underline">
        use DOGDZI as a guest
      </Link>
      .
    </Notice>
  );
}

/** Map Supabase auth errors to plain language without revealing whether an email exists. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "That email and password don't match.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("rate") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password")) return message;
  return "Something went wrong. Please try again.";
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "That link has expired or was already used. Request a new one." : null);
  const [busy, setBusy] = useState(false);
  if (!sb) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    setError(null);
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(friendly(err.message));
    router.push("/app");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-xl bg-missed-bg px-3.5 py-2.5 text-sm font-medium text-missed">
          {error}
        </p>
      )}
      <Field label="Email">{({ id }) => <Input id={id} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
      <Field label="Password" hint={<Link href="/forgot-password" className="font-semibold underline-offset-2 hover:underline">Forgot password?</Link>}>
        {({ id, describedBy }) => <PasswordInput id={id} aria-describedby={describedBy} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const sb = getBrowserSupabase();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasGuest, setHasGuest] = useState(false);
  useEffect(() => {
    try {
      setHasGuest(hasGuestData(readGuestSnapshot(localStorage)));
    } catch {
      /* storage unavailable */
    }
  }, []);
  if (!sb) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const name = normalizeFirstName(firstName);
    if (!name) errs.firstName = "Tell us what to call you.";
    if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errs.password = "Include at least one letter and one number.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`, data: { first_name: name } },
    });
    setBusy(false);
    if (error) return setErrors({ form: friendly(error.message) });
    trackEvent("signup_completed", { source: hasGuest ? "guest" : "direct" });
    if (data.session) {
      router.push("/app");
      router.refresh();
    } else setSent(true);
  };

  if (sent)
    return (
      <div role="status" className="space-y-3 text-center">
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-sm text-muted">
          We sent a confirmation link to <b className="text-fg">{email}</b>. Open it on this device{hasGuest ? " so your guest actions move into your account" : ""}.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {hasGuest && <Notice>Your guest actions on this device will move into your new account automatically.</Notice>}
      {errors.form && (
        <p role="alert" className="rounded-xl bg-missed-bg px-3.5 py-2.5 text-sm font-medium text-missed">
          {errors.form}
        </p>
      )}
      <Field label="First name" error={errors.firstName}>
        {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="given-name" autoCapitalize="words" maxLength={FIRST_NAME_MAX} value={firstName} onChange={(e) => setFirstName(e.target.value)} />}
      </Field>
      <Field label="Email" error={errors.email}>
        {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Field label="Password" error={errors.password} hint="At least 8 characters with a letter and a number.">
        {({ id, describedBy, invalid }) => <PasswordInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Create account
      </Button>
      <p className="text-center text-xs text-muted">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          Privacy Notice
        </Link>
        .
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const sb = getBrowserSupabase();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (!sb) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` });
    setBusy(false);
    // Same message whether or not the account exists.
    setSent(true);
  };

  if (sent) return <p role="status" className="text-sm">If an account exists for <b>{email}</b>, a reset link is on its way. It expires in one hour.</p>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Email" error={error}>
        {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Send reset link
      </Button>
    </form>
  );
}

export function UpdatePasswordForm() {
  const router = useRouter();
  const sb = getBrowserSupabase();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!sb) return <NotConfigured />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Use at least 8 characters with a letter and a number.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error: err } = await sb.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message.includes("session") ? "This reset link has expired. Request a new one." : friendly(err.message));
    router.push("/app");
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <p role="alert" className="rounded-xl bg-missed-bg px-3.5 py-2.5 text-sm font-medium text-missed">
          {error}
        </p>
      )}
      <Field label="New password">{({ id }) => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <Field label="Confirm new password">{({ id }) => <PasswordInput id={id} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        Update password
      </Button>
    </form>
  );
}
