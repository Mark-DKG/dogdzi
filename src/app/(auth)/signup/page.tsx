import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/app/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Create your free account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Routines, roadmaps, full history, recovery plans and secure sync.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-fg underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
