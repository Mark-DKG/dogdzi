import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function UpdatePasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">You&apos;ll stay signed in on this device.</p>
      <UpdatePasswordForm />
    </>
  );
}
