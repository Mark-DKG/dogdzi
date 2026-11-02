import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/signin" className="font-semibold underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
