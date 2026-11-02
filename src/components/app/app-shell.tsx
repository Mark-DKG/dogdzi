"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { reviewQueue } from "@/lib/domain/actions";
import { GUEST_LIMITS } from "@/lib/domain/limits";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Monogram } from "@/components/brand/logo";
import { IconCalendar, IconChart, IconCloudOff, IconFlag, IconHistory, IconLogout, IconPlus, IconReview, IconSettings, IconToday, IconUser } from "@/components/icons";
import { Button, LinkButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { ComposerProvider, useComposer } from "./composer";
import { useData } from "./data-provider";
import { InstallBanner } from "./install-app";
import { UpgradeDialog } from "./gate";
import { ReminderEngine } from "./reminder-engine";
import { PushAutoEnable } from "./push-auto";
import { SessionTracker } from "./session-tracker";
import { TermsGate } from "./terms-gate";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/app", label: "Today", icon: IconToday, mobile: true },
  { href: "/app/upcoming", label: "Upcoming", icon: IconCalendar, mobile: true },
  { href: "/app/goals", label: "Goals", icon: IconFlag, mobile: true },
  { href: "/app/review", label: "Review", icon: IconReview, mobile: true },
  { href: "/app/history", label: "History", icon: IconHistory, mobile: false },
  { href: "/app/insights", label: "Insights", icon: IconChart, mobile: false },
  { href: "/app/settings", label: "Settings", icon: IconSettings, mobile: true },
];

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ComposerProvider>
      <Shell>{children}</Shell>
      <UpgradeDialog />
      <TermsGate />
      <ReminderEngine />
    </ComposerProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/app";
  const { snapshot, mode, user, status, signOut, persistent, accountsAvailable } = useData();
  const composer = useComposer();
  const router = useRouter();
  const reviewCount = status === "ready" ? reviewQueue(snapshot).length : 0;

  return (
    <div className="min-h-dvh lg:pl-64">
      <SessionTracker signedIn={!!user} />
      <PushAutoEnable />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-forest-900 text-cream-100 lg:flex" aria-label="Main">
        <div className="px-5 pb-4 pt-6">
          <Link href="/app" aria-label="DOGDZI home" className="inline-block">
            <Monogram height={30} tile={false} />
          </Link>
        </div>
        <div className="px-4 pb-4">
          <Button variant="brand" className="w-full" onClick={() => composer.newAction()}>
            <IconPlus size={18} /> New action
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active ? "bg-forest-700 text-cream-200" : "text-forest-100 hover:bg-forest-800 hover:text-cream-100",
                )}
              >
                <Icon size={19} />
                <span className="flex-1">{label}</span>
                {href === "/app/review" && reviewCount > 0 && <span className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-bold text-forest-900">{reviewCount}</span>}
              </Link>
            );
          })}
          <ThemeToggle variant="menu" />
        </nav>
        <div className="border-t border-forest-700 p-4">
          {mode === "account" && user ? (
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-700 text-cream-200">
                <IconUser size={18} />
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-forest-100" title={user.email ?? undefined}>
                {user.email}
              </span>
              <button type="button" onClick={() => void signOut()} className="rounded-lg p-2 text-forest-200 hover:bg-forest-800 hover:text-cream-100" aria-label="Sign out">
                <IconLogout size={18} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-forest-200">Guest mode · saved on this device only</p>
              {accountsAvailable && (
                <LinkButton href="/signup" variant="brand" size="sm" className="w-full">
                  Create free account
                </LinkButton>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-forest-900 pb-1 pl-4 pr-2 pt-[max(0.25rem,env(safe-area-inset-top))] lg:hidden">
        <Link href="/app" aria-label="DOGDZI home" className="flex h-11 items-center">
          <Monogram height={22} tile={false} />
        </Link>
        <div className="flex items-center">
          {mode === "guest" && accountsAvailable && (
            <Link href="/signup" className="mr-1 flex h-9 items-center rounded-lg bg-cream-200 px-3 text-xs font-bold text-forest-900">
              Sign up
            </Link>
          )}
          <ThemeToggle variant="bar" />
          <Menu
            label="More"
            triggerClassName="text-forest-100 hover:bg-forest-800 hover:text-cream-100"
            items={[
              { label: "History", icon: <IconHistory size={18} />, onSelect: () => router.push("/app/history") },
              { label: "Insights", icon: <IconChart size={18} />, onSelect: () => router.push("/app/insights") },
            ]}
          />
        </div>
      </header>

      <Banners guest={mode === "guest" && status === "ready"} persistent={persistent} />

      <main id="main" className="mx-auto w-full max-w-3xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:pb-16 lg:pt-10">
        {children}
      </main>

      {/* Mobile floating add button */}
      <button
        type="button"
        onClick={() => composer.newAction()}
        className="hide-with-keyboard fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-xl lg:hidden"
        aria-label="New action"
      >
        <IconPlus size={26} />
      </button>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="hide-with-keyboard fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-md">
          {NAV.filter((n) => n.mobile).map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-2 text-[11px]", active ? "font-bold text-fg" : "font-medium text-muted")}
                >
                  <span className={cn("rounded-full px-3.5 py-1 transition-colors", active ? "bg-primary text-primary-fg" : "")}>
                    <Icon size={20} />
                  </span>
                  {label}
                  {href === "/app/review" && reviewCount > 0 && (
                    <span className="absolute right-[18%] top-1.5 min-w-4 rounded-full bg-missed px-1 text-center text-[10px] font-bold text-cream-50 dark:text-forest-950">
                      {reviewCount}
                      <span className="sr-only"> need review</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Banners({ guest, persistent }: { guest: boolean; persistent: boolean }) {
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [hideGuest, setHideGuest] = useState(true);
  useEffect(() => {
    setHideGuest(sessionStorage.getItem("dogdzi:hide-guest-banner") === "1");
    const sb = getBrowserSupabase();
    if (!sb) return;
    sb.from("system_settings")
      .select("value")
      .eq("key", "announcement")
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value as { text?: string; active?: boolean } | undefined;
        if (v?.active && v.text) setAnnouncement(v.text);
      });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-2 px-4 pt-4 sm:px-6 empty:hidden">
      {announcement && (
        <div role="status" className="rounded-2xl bg-forest-900 px-4 py-3 text-sm text-cream-100">
          {announcement}
        </div>
      )}
      {!persistent && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn-bg px-4 py-3 text-sm">
          <IconCloudOff size={18} className="mt-0.5 shrink-0 text-warn" />
          <span>Your browser is blocking storage (private mode?). Anything you add disappears when you close this tab.</span>
        </div>
      )}
      {/* One tip at a time: the guest notice first, then the install suggestion. */}
      {!(guest && persistent && !hideGuest) && <InstallBanner />}
      {guest && persistent && !hideGuest && (
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <IconCloudOff size={18} className="mt-0.5 shrink-0 text-muted" />
          <p className="flex-1 text-fg">
            <span className="font-semibold">Guest mode.</span> Your actions are saved in this browser only, with no backup or sync. Up to {GUEST_LIMITS.maxActiveActions} active actions.{" "}
            <Link href="/signup" className="font-semibold underline underline-offset-2">
              Create a free account
            </Link>{" "}
            to keep everything safe.
          </p>
          <button
            type="button"
            className="-my-2 -mr-2 flex h-11 shrink-0 items-center rounded-xl px-3 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg"
            onClick={() => {
              sessionStorage.setItem("dogdzi:hide-guest-banner", "1");
              setHideGuest(true);
            }}
          >
            Hide
          </button>
        </div>
      )}
    </div>
  );
}
