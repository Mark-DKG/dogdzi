"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addCategory, updatePreferences } from "@/lib/domain/actions";
import { isValidHHMM } from "@/lib/domain/dates";
import { STYLE_DESCRIPTIONS } from "@/lib/domain/reminders";
import { AREA_META } from "@/lib/domain/snapshot";
import { LIFE_AREAS, REMINDER_STYLES, type LifeArea, type ReminderStyle } from "@/lib/domain/types";
import { analyticsAllowed, writeConsent } from "@/lib/analytics/client";
import { notificationsSupported, pushConfigured, requestNotificationPermission, subscribeToPush, unsubscribeFromPush } from "@/lib/push/client";
import { GUEST_KEY } from "@/lib/store/local-repo";
import { useData } from "@/components/app/data-provider";
import { InstallCard } from "@/components/app/install-app";
import { ThemeChooser } from "@/components/app/theme-toggle";
import { DataGate } from "@/components/app/gate";
import { IconChart, IconHistory, IconLogout } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChips, Field, Input, Switch, ToggleChips } from "@/components/ui/field";
import { SettingsSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Card, PageHeader } from "@/components/ui/surface";

export default function SettingsPage() {
  return <DataGate skeleton={<SettingsSkeleton />}>{() => <Settings />}</DataGate>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4 p-5">
      <h2 className="text-base font-bold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </Card>
  );
}

function Settings() {
  const { snapshot, run, mode, user, signOut, accountsAvailable, allow } = useData();
  const toast = useToast();
  const p = snapshot.preferences;
  const [quietStart, setQuietStart] = useState(p.quietStart);
  const [quietEnd, setQuietEnd] = useState(p.quietEnd);
  const [maxPerDay, setMaxPerDay] = useState(String(p.maxNotificationsPerDay));
  const [newCat, setNewCat] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [consent, setConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    setPermission(notificationsSupported() ? Notification.permission : "unsupported");
    setConsent(analyticsAllowed());
  }, []);

  const save = (changes: Parameters<typeof updatePreferences>[1], msg = "Saved") => void run((s, ctx) => updatePreferences(s, changes, ctx), { success: msg });

  const saveQuiet = () => {
    if (!isValidHHMM(quietStart) || !isValidHHMM(quietEnd)) return toast.show("Enter valid times for quiet hours.", "error");
    const n = Number(maxPerDay);
    if (!Number.isInteger(n) || n < 1 || n > 50) return toast.show("Daily limit must be between 1 and 50.", "error");
    save({ quietStart, quietEnd, maxNotificationsPerDay: n });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dogdzi-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:hidden">
        <LinkButton href="/app/history" variant="secondary">
          <IconHistory size={18} /> History
        </LinkButton>
        <LinkButton href="/app/insights" variant="secondary">
          <IconChart size={18} /> Insights
        </LinkButton>
      </div>

      <Section title="Account">
        {mode === "account" && user ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{user.email}</p>
              <p className="text-xs text-muted">Synced securely across your devices.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              <IconLogout size={16} /> Sign out
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              You&apos;re using DOGDZI as a <b>guest</b>. Your data is stored in this browser only. It isn&apos;t backed up and doesn&apos;t sync to other devices.
            </p>
            {accountsAvailable ? (
              <div className="flex gap-2">
                <LinkButton href="/signup" size="sm">
                  Create free account
                </LinkButton>
                <LinkButton href="/signin" size="sm" variant="secondary">
                  Sign in
                </LinkButton>
              </div>
            ) : (
              <p className="text-xs text-muted">Accounts aren&apos;t enabled on this server yet.</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Appearance" description="Saved on this device.">
        <ThemeChooser />
      </Section>

      <Section title="Install app">
        <InstallCard />
      </Section>

      <Section title="Life areas" description="Choose the parts of life you want to organise. Each becomes a category.">
        <ToggleChips
          label="Areas"
          options={LIFE_AREAS.filter((a) => a !== "custom").map((a) => ({ value: a, label: AREA_META[a].label }))}
          values={p.lifeAreas}
          onChange={(v: LifeArea[]) => save({ lifeAreas: v })}
        />
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run((s, ctx) => addCategory(s, newCat, "custom", AREA_META.custom.color, ctx), { success: "Category added" })) setNewCat("");
          }}
        >
          <Input aria-label="New custom category" placeholder="Add a custom category, e.g. Side project" value={newCat} maxLength={40} onChange={(e) => setNewCat(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={!newCat.trim()}>
            Add
          </Button>
        </form>
        <ul className="flex flex-wrap gap-2">
          {snapshot.categories
            .filter((c) => !c.archived)
            .map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Reminders" description="How DOGDZI nudges you. Quiet hours are always respected.">
        <ChoiceChips
          label="Reminder style"
          value={p.reminderStyle}
          onChange={(v: ReminderStyle) => save({ reminderStyle: v })}
          options={REMINDER_STYLES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
        />
        <p className="-mt-2 text-sm text-muted">{STYLE_DESCRIPTIONS[p.reminderStyle]}</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quiet from">{({ id }) => <Input id={id} type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />}</Field>
          <Field label="Quiet until">{({ id }) => <Input id={id} type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />}</Field>
          <Field label="Max per day">{({ id }) => <Input id={id} type="number" min={1} max={50} value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} />}</Field>
        </div>
        <Button variant="secondary" size="sm" onClick={saveQuiet}>
          Save quiet hours & limit
        </Button>

        <div className="space-y-4 border-t border-line pt-5">
          <Switch
            label="System notifications while DOGDZI is open"
            description={
              permission === "unsupported"
                ? "This browser doesn't support notifications. You'll see reminders inside the app."
                : permission === "denied"
                  ? "Blocked in your browser settings. Reminders appear inside the app instead."
                  : "Without this, reminders appear as messages inside the app."
            }
            checked={permission === "granted"}
            disabled={permission === "unsupported" || permission === "denied" || permission === "granted"}
            onChange={async () => setPermission(await requestNotificationPermission())}
          />
          <Switch
            label="Push reminders when DOGDZI is closed"
            description={
              mode === "guest"
                ? "Needs a free account."
                : !pushConfigured
                  ? "Not configured on this server yet (VAPID keys required)."
                  : "Sends reminders to this device through your browser's push service."
            }
            checked={p.pushEnabled}
            disabled={pushBusy || (mode === "account" && !pushConfigured)}
            onChange={async (on) => {
              if (on && !allow("push")) return;
              setPushBusy(true);
              if (on) {
                const r = await subscribeToPush();
                if (r.ok) save({ pushEnabled: true }, "Push reminders on for this device");
                else toast.show(r.message, "error");
              } else {
                await unsubscribeFromPush();
                save({ pushEnabled: false }, "Push reminders off");
              }
              setPushBusy(false);
            }}
          />
        </div>
      </Section>

      <Section title="Privacy & data">
        <Switch
          label="Anonymous usage analytics"
          description="Visits, time in the app and events like 'action completed'. Never what your actions say."
          checked={consent}
          onChange={(v) => {
            writeConsent(v);
            setConsent(v);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportData}>
            Download my data (JSON)
          </Button>
          <LinkButton href="/privacy" variant="ghost" size="sm">
            Privacy notice
          </LinkButton>
        </div>
        <div className="border-t border-line pt-5">
          {mode === "account" ? (
            <Button variant="ghost" size="sm" className="text-missed" onClick={() => setDeleting(true)}>
              Delete account…
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="text-missed" onClick={() => setDeleting(true)}>
              Erase guest data from this browser…
            </Button>
          )}
        </div>
      </Section>

      <p className="mt-6 text-center text-xs text-muted">
        By 9DEVs ·{" "}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
      </p>

      {deleting && <DeleteDialog guest={mode === "guest"} onClose={() => setDeleting(false)} />}
    </div>
  );
}

function DeleteDialog({ guest, onClose }: { guest: boolean; onClose: () => void }) {
  const { retry } = useData();
  const toast = useToast();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setError(null);
    setBusy(true);
    if (guest) {
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch {
        /* ignore */
      }
      toast.show("Guest data erased from this browser.", "success");
      setBusy(false);
      onClose();
      retry();
      return;
    }
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm, password }) }).catch(() => null);
    setBusy(false);
    if (!res) return setError("Network error. Please try again.");
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't delete the account.");
    window.location.href = "/?deleted=1";
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={guest ? "Erase guest data?" : "Delete your account?"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} disabled={confirm !== "DELETE" || (!guest && !password)} onClick={go}>
            {guest ? "Erase" : "Delete permanently"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          {guest
            ? "This removes every action, goal and history entry stored in this browser. It can't be undone."
            : "This permanently deletes your account, actions, goals, history and reminders. Download your data first if you want a copy. It can't be undone."}
        </p>
        <Field label='Type "DELETE" to confirm'>{({ id }) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
        {!guest && <Field label="Your password">{({ id }) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}</Field>}
        {error && (
          <p role="alert" className="font-medium text-missed">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
