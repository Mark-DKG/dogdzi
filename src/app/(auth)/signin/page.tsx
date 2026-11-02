import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/app/auth-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Sign in to sync your actions across devices.</p>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        <SignInForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-fg underline-offset-2 hover:underline">
          Create an account
        </Link>{" "}
        or{" "}
        <Link href="/app" className="font-semibold text-fg underline-offset-2 hover:underline">
          continue as guest
        </Link>
      </p>
    </>
  );
}
