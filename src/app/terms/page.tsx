import type { Metadata } from "next";
import Link from "next/link";
import { Monogram } from "@/components/brand/logo";
import { TERMS, TERMS_UPDATED } from "@/lib/legal/terms";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="min-h-dvh">
      <header className="bg-forest-900 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label="Dogdzi home" className="inline-flex min-h-11 items-center">
            <Monogram height={22} tile={false} />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Last updated {TERMS_UPDATED}</p>

        <nav aria-label="Contents" className="mt-8 rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Contents</p>
          <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
            {TERMS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline-offset-2 hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {TERMS.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6">
            <h2 className="mt-10 text-xl font-bold">{s.title}</h2>
            {s.body.map((b, i) =>
              typeof b === "string" ? (
                <p key={i} className="mt-3">
                  {b}
                </p>
              ) : (
                <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5">
                  {b.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}

        <p className="mt-12 text-sm text-muted">
          See also our{" "}
          <Link href="/privacy" className="underline">
            Privacy Notice
          </Link>
          .{" "}
          <Link href="/" className="underline">
            Back to home
          </Link>
        </p>
        <p className="mt-6 text-xs text-muted">By 9DEVs</p>
      </main>
    </div>
  );
}
