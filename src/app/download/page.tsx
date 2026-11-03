import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/brand/logo";
import { DownloadOptions } from "./download-options";

export const metadata: Metadata = {
  title: "Get the app",
  description: "Install DOGDZI on Android, iPhone or your computer.",
};

export default function DownloadPage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-forest-900 px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))] text-cream-100">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label="DOGDZI home" className="inline-flex min-h-11 items-center">
            <Monogram height={22} tile={false} />
          </Link>
          <h1 className="mt-8 text-3xl font-bold tracking-tight sm:text-4xl">Get DOGDZI on your phone</h1>
          <p className="mt-3 max-w-xl text-forest-100">
            Free on Android, iPhone and computers. Sign in and your actions, goals and history follow you to every device.
          </p>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-8">
        <DownloadOptions />
        <p className="mt-10 text-center text-sm text-muted">
          Prefer the browser?{" "}
          <Link href="/app" className="font-semibold text-fg underline underline-offset-4">
            Open DOGDZI
          </Link>{" "}
          · <Link href="/privacy" className="underline underline-offset-4">Privacy</Link> ·{" "}
          <Link href="/terms" className="underline underline-offset-4">Terms</Link>
        </p>
      </main>
    </div>
  );
}
