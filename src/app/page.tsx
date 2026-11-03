import Link from "next/link";
import { Lockup, Monogram } from "@/components/brand/logo";
import { IconCheck, IconCloudOff, IconLifebuoy, IconLock, IconRepeat, IconReview, IconShield } from "@/components/icons";
import { LinkButton } from "@/components/ui/button";
import { GUEST_LIMITS } from "@/lib/domain/limits";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const FLOW = [
  { step: "Create", text: "Write down the action, small and specific." },
  { step: "Schedule", text: "Give it a day and, if it helps, a time." },
  { step: "Remind", text: "Gentle to persistent nudges that respect quiet hours." },
  { step: "Execute", text: "Tick it off. Watch your streaks build." },
  { step: "Review", text: "Missed it? Note why, without blame." },
  { step: "Recover", text: "Reschedule, make a plan, or let it go, on the record." },
];

const AREAS = ["Personal", "Work", "Education", "Health", "Home", "Finance", "Social", "Your own"];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="bg-forest-900 text-cream-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
          <Link href="/" aria-label="DOGDZI home" className="flex min-h-11 items-center">
            <Monogram height={24} tile={false} />
          </Link>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/download" className="flex min-h-11 items-center rounded-lg px-3 text-forest-100 hover:text-cream-100">
              Get the app
            </Link>
            <Link href="/privacy" className="hidden min-h-11 items-center rounded-lg px-3 text-forest-100 hover:text-cream-100 sm:flex">
              Privacy
            </Link>
            {isSupabaseConfigured && (
              <Link href="/signin" className="flex min-h-11 items-center rounded-lg px-3 text-forest-100 hover:text-cream-100">
                Sign in
              </Link>
            )}
          </nav>
        </div>

        <section id="main" className="mx-auto flex max-w-6xl flex-col items-center px-5 pb-20 pt-12 text-center sm:pt-16">
          <h1 className="sr-only">DOGDZI</h1>
          <Lockup width={420} priority className="w-64 sm:w-96" />
          <p className="mt-8 max-w-xl text-lg text-forest-100">
            Plan your actions, follow through, account for what slipped, and recover. A calm, honest system for everyday life.
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <LinkButton href="/onboarding" variant="brand" size="lg">
              Start now, no sign-up needed
            </LinkButton>
            {isSupabaseConfigured && (
              <LinkButton href="/signup" variant="ghost" size="lg" className="text-cream-100! hover:bg-forest-800!">
                Create free account
              </LinkButton>
            )}
          </div>
        </section>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center text-xs font-bold uppercase tracking-[0.2em] text-muted">How it works</h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FLOW.map((f, i) => (
              <li key={f.step} className="rounded-2xl border border-line bg-surface p-5">
                <span className="text-xs font-bold text-forest-500">0{i + 1}</span>
                <h3 className="mt-1 text-lg font-bold">{f.step}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-surface-2">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Accountability that helps you, not judges you.</h2>
              <p className="mt-4 text-muted">
                When something slips, DOGDZI asks what got in the way and lets you choose what happens next. Nothing is quietly deleted, so your record stays honest and you can see patterns over time.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  [IconReview, "Missed actions wait for a quick review instead of vanishing."],
                  [IconLifebuoy, "Recovery plans break a restart into small steps."],
                  [IconRepeat, "Routines and habits with streaks that forgive a bad day."],
                  [IconShield, "A history you can trust. Even our staff can't rewrite it."],
                ].map(([Icon, text], i) => {
                  const I = Icon as typeof IconCheck;
                  return (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-900 text-cream-200">
                        <I size={16} />
                      </span>
                      <span className="pt-1.5">{text as string}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm" aria-hidden="true">
              <p className="text-sm font-bold">Let&apos;s review this one</p>
              <p className="text-xs text-muted">Gym session · Yesterday, 6:30am</p>
              <p className="mt-5 text-xs font-semibold text-muted">What got in the way?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["It slipped my mind", "Low energy", "Something came up"].map((r, i) => (
                  <span key={r} className={i === 1 ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg" : "rounded-full border border-line px-3 py-1.5 text-xs font-semibold"}>
                    {r}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-xs font-semibold text-muted">What&apos;s next?</p>
              <div className="mt-2 space-y-2">
                {["Reschedule to this evening", "Make a recovery plan", "Let this one go"].map((r, i) => (
                  <div key={r} className={i === 0 ? "rounded-xl border border-primary bg-surface-2 px-3 py-2.5 text-sm font-semibold" : "rounded-xl border border-line px-3 py-2.5 text-sm"}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight">For every part of life</h2>
          <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
            {AREAS.map((a) => (
              <li key={a} className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold">
                {a}
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-2">
                <IconCloudOff size={18} className="text-muted" />
                <h3 className="font-bold">Try it as a guest</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[`Up to ${GUEST_LIMITS.maxActiveActions} active actions`, "Scheduling and in-app reminders", "Review and reschedule missed actions", "One goal with a short roadmap"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-done" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">Stored only in your browser. Not backed up or synced.</p>
            </div>
            <div className="rounded-2xl bg-forest-900 p-6 text-cream-100">
              <div className="flex items-center gap-2">
                <IconLock size={18} className="text-cream-200" />
                <h3 className="font-bold text-cream-200">Free account</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {["Unlimited actions, routines and habits", "Goals, projects, roadmaps and milestones", "Full history, recovery plans and insights", "Secure sync across devices", "Push reminders when the app is closed"].map((t) => (
                  <li key={t} className="flex gap-2">
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-cream-200" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-forest-200">Your guest data moves across when you sign up.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-forest-900 text-cream-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <Monogram height={20} tile={false} />
            <p className="text-xs font-medium text-forest-200">By 9DEVs</p>
          </div>
          <nav className="flex gap-1 text-sm text-forest-100 [&>a]:flex [&>a]:min-h-11 [&>a]:items-center [&>a]:px-3">
            <Link href="/privacy" className="hover:text-cream-100">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-cream-100">
              Terms
            </Link>
            <Link href="/download" className="hover:text-cream-100">
              Get the app
            </Link>
            <Link href="/app" className="hover:text-cream-100">
              Open app
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
