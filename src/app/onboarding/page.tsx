"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createAction, updatePreferences } from "@/lib/domain/actions";
import { isValidHHMM } from "@/lib/domain/dates";
import { STYLE_DESCRIPTIONS } from "@/lib/domain/reminders";
import { AREA_META, DEFAULT_AREAS } from "@/lib/domain/snapshot";
import { LIFE_AREAS, REMINDER_STYLES, type LifeArea, type ReminderStyle } from "@/lib/domain/types";
import { trackEvent } from "@/lib/analytics/client";
import { notificationsSupported, requestNotificationPermission } from "@/lib/push/client";
import { useData } from "@/components/app/data-provider";
import { acceptTermsChanges, TermsCheckbox } from "@/components/app/terms-gate";
import { Lockup, Tagline } from "@/components/brand/logo";
import { IconArrowRight, IconBell, IconCheck } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/button";
import { ChoiceChips, Field, Input, ToggleChips } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

const FLOW = ["Create", "Schedule", "Remind", "Execute", "Review", "Recover"];
const STEPS = 5;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <Onboarding />
    </Suspense>
  );
}

function OnboardingSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-lg px-5 py-12">
      <span className="sr-only">Loading</span>
      <Skeleton className="mx-auto h-24 w-56" />
      <Skeleton className="mt-8 h-6 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
      <Skeleton className="mt-8 h-12 w-full rounded-xl" />
    </div>
  );
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, error, retry, snapshot, run, today, mode, accountsAvailable } = useData();
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState<LifeArea[]>(DEFAULT_AREAS);
  const [style, setStyle] = useState<ReminderStyle>("standard");
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);

  useEffect(() => {
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);
  useEffect(() => {
    if (status === "ready") {
      if (snapshot.preferences.onboardingCompleted && params.get("redo") !== "1") router.replace("/app");
      setAreas(snapshot.preferences.lifeAreas);
      setStyle(snapshot.preferences.reminderStyle);
      setDate(today);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "loading") return <OnboardingSkeleton />;
  if (status === "error")
    return (
      <div className="mx-auto max-w-lg px-5 py-12">
        <ErrorState message={error ?? "Please try again."} onRetry={retry} />
      </div>
    );

  const finish = async (to: string) => {
    if (!agreed) {
      setTermsError(true);
      return;
    }
    const ok = await run((s, ctx) => updatePreferences(s, { onboardingCompleted: true, ...acceptTermsChanges(ctx.now.toISOString()) }, ctx));
    if (!ok) return;
    trackEvent("onboarding_completed", { mode, style });
    router.push(to);
  };
  const savePrefs = () =>
    run((s, ctx) =>
      updatePreferences(
        s,
        { lifeAreas: areas, reminderStyle: style, quietStart: isValidHHMM(quietStart) ? quietStart : "22:00", quietEnd: isValidHHMM(quietEnd) ? quietEnd : "07:00" },
        ctx,
      ),
    );

  const next = async () => {
    if (step === 1 || step === 2) await savePrefs();
    if (step === 3 && title.trim()) {
      setTitleError(null);
      const ok = await run((s, ctx) => createAction(s, { title, startDate: date, time: time || null }, ctx), { capability: "create_action" });
      if (!ok) return;
    }
    setStep((s) => Math.min(STEPS - 1, s + 1));
  };

  return (
    <div className="min-h-dvh bg-bg">
      <div className="bg-forest-900 px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] text-cream-100">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i <= step ? "w-6 bg-cream-200" : "w-3 bg-forest-700")} />
            ))}
          </div>
          {step < STEPS - 1 && (
            <button type="button" onClick={() => setStep(STEPS - 1)} className="text-sm font-semibold text-forest-100 hover:text-cream-100">
              Skip for now
            </button>
          )}
        </div>
        {step === 0 && (
          <div className="mx-auto mt-10 max-w-lg text-center">
            <Lockup width={240} priority className="mx-auto" />
            <Tagline className="mt-5 text-cream-200" />
          </div>
        )}
      </div>

      <main id="main" className="mx-auto max-w-lg animate-fade-in px-5 py-8" key={step}>
        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Plan it. Do it. Own the outcome.</h1>
            <p className="mt-3 text-muted">
              DOGDZI helps you follow through on everyday commitments. When something slips, you note what happened and pick a way forward. No guilt trips, and nothing quietly disappears.
            </p>
            <ol className="mt-6 flex flex-wrap gap-2" aria-label="How DOGDZI works">
              {FLOW.map((f, i) => (
                <li key={f} className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold">
                  {i + 1}. {f}
                </li>
              ))}
            </ol>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">What do you want to organise?</h1>
            <p className="mt-2 text-muted">Pick the areas of life you&apos;ll plan in. You can add custom ones later.</p>
            <ToggleChips
              className="mt-6"
              label="Life areas"
              options={LIFE_AREAS.filter((a) => a !== "custom").map((a) => ({ value: a, label: AREA_META[a].label }))}
              values={areas}
              onChange={setAreas}
            />
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">How should we remind you?</h1>
            <p className="mt-2 text-muted">You can change this any time, and override it per action.</p>
            <ChoiceChips className="mt-6" label="Reminder style" value={style} onChange={setStyle} options={REMINDER_STYLES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
            <p className="mt-2 text-sm text-muted">{STYLE_DESCRIPTIONS[style]}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Field label="Quiet hours from">{({ id }) => <Input id={id} type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />}</Field>
              <Field label="until">{({ id }) => <Input id={id} type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />}</Field>
            </div>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <IconBell className="mt-0.5 text-forest-500" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Notifications</p>
                  <p className="text-xs text-muted">
                    {perm === "granted"
                      ? "Allowed. You'll get reminders while DOGDZI is open."
                      : perm === "denied"
                        ? "Blocked in your browser. Reminders will show inside the app."
                        : perm === "unsupported"
                          ? "Not supported in this browser. Reminders will show inside the app."
                          : "We only ask when you tap the button. Nothing is sent outside your settings."}
                  </p>
                </div>
                {perm === "default" && (
                  <Button size="sm" variant="secondary" onClick={async () => setPerm(await requestNotificationPermission())}>
                    Allow
                  </Button>
                )}
                {perm === "granted" && <IconCheck className="text-done" />}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">Your first action</h1>
            <p className="mt-2 text-muted">Something small and specific you&apos;ll do soon. &ldquo;Call the landlord at 10&rdquo; beats &ldquo;sort housing&rdquo;.</p>
            <div className="mt-6 space-y-4">
              <Field label="What will you do?" optional error={titleError}>
                {({ id, invalid }) => <Input id={id} aria-invalid={invalid} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 20-minute walk after lunch" autoFocus />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="When">{({ id }) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
                <Field label="Time" optional>
                  {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
                </Field>
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-2xl font-bold tracking-tight">You&apos;re set up.</h1>
            {mode === "account" ? (
              <p className="mt-2 text-muted">Everything syncs to your account.</p>
            ) : (
              <>
                <p className="mt-2 text-muted">You&apos;re in guest mode: everything stays in this browser, with no backup or sync. A free account adds:</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {["Routines and habits that repeat", "Goals with full roadmaps and milestones", "Complete history, recovery plans and insights", "Secure sync and backup across devices", "Push reminders when the app is closed"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <IconCheck size={16} className="text-done" /> {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted">Anything you&apos;ve added as a guest moves into your account when you sign up.</p>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <div className="mt-8">
            <TermsCheckbox
              checked={agreed}
              onChange={(v) => {
                setAgreed(v);
                if (v) setTermsError(false);
              }}
            />
            {termsError && (
              <p role="alert" className="mt-2 text-sm font-medium text-missed">
                Please accept the Terms of Service to continue.
              </p>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-col gap-2">
          {step < 4 ? (
            <Button size="lg" onClick={() => void next()}>
              {step === 3 && !title.trim() ? "Skip this step" : "Continue"} <IconArrowRight size={18} />
            </Button>
          ) : mode === "guest" && accountsAvailable ? (
            <>
              <Button size="lg" onClick={() => void finish("/signup")}>
                Create free account
              </Button>
              <Button size="lg" variant="ghost" onClick={() => void finish("/app")}>
                Continue as guest
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={() => void finish("/app")}>
              Go to today <IconArrowRight size={18} />
            </Button>
          )}
          {step > 0 && step < 4 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          {step === 0 && accountsAvailable && (
            <LinkButton href="/signin" variant="ghost">
              I already have an account
            </LinkButton>
          )}
        </div>
      </main>
    </div>
  );
}
