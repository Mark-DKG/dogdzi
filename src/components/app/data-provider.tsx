"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DomainError, maintenance } from "@/lib/domain/actions";
import { deviceTimeZone, safeTimeZone, toISODate } from "@/lib/domain/dates";
import { uuid } from "@/lib/domain/ids";
import { checkCapability, type Capability } from "@/lib/domain/limits";
import { applyPatch, emptySnapshot, isPatchEmpty, mergePatches, missingAreaCategories } from "@/lib/domain/snapshot";
import type { Ctx, DataMode, ISODate, Patch, Snapshot } from "@/lib/domain/types";
import { trackEvent } from "@/lib/analytics/client";
import type { EventName } from "@/lib/analytics/policy";
import { browserKV, hasGuestData, LocalRepo, readGuestSnapshot } from "@/lib/store/local-repo";
import { planGuestMigration } from "@/lib/store/migrate-guest";
import { RepoError, withTimeout, type HistoryPage, type Repo } from "@/lib/store/repo";
import { SupabaseRepo } from "@/lib/store/supabase-repo";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useToast } from "@/components/ui/toast";

const LOAD_TIMEOUT_MS = 15_000;
const SAVE_TIMEOUT_MS = 15_000;
const MAINTENANCE_MS = 60_000;

type Status = "loading" | "ready" | "error";
export interface SessionUser {
  id: string;
  email: string | null;
}

type Op = (s: Snapshot, ctx: Ctx) => Patch;
interface RunOptions {
  capability?: Capability;
  capabilityRef?: { goalId?: string };
  success?: string;
}

interface DataApi {
  status: Status;
  error: string | null;
  snapshot: Snapshot;
  mode: DataMode;
  user: SessionUser | null;
  accountsAvailable: boolean;
  /** False when the browser won't let us persist guest data (private mode). */
  persistent: boolean;
  today: ISODate;
  run(op: Op, opts?: RunOptions): Promise<boolean>;
  /** Returns true if allowed; otherwise opens the upgrade prompt. */
  allow(cap: Capability, ref?: { goalId?: string }): boolean;
  upgrade: { reason: string } | null;
  dismissUpgrade(): void;
  retry(): void;
  signOut(): Promise<void>;
  listHistory(opts: { before?: string; limit?: number }): Promise<HistoryPage>;
}

const DataContext = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const v = useContext(DataContext);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}

/** Derive privacy-safe analytics events from what a patch did. */
function eventsFromPatch(p: Patch, mode: DataMode): [EventName, Record<string, unknown>][] {
  const out: [EventName, Record<string, unknown>][] = [];
  for (const e of p.append.events ?? []) {
    if (e.type === "created") out.push([e.data.recurring ? "routine_created" : "action_created", { mode }]);
    else if (e.type === "completed") out.push(["action_completed", { mode, late: false }]);
    else if (e.type === "completed_late") out.push(["action_completed", { mode, late: true }]);
    else if (e.type === "missed") out.push(["action_missed", { mode }]);
    else if (e.type === "skipped") out.push(["action_skipped", { mode }]);
    else if (e.type === "recovery_plan_created") out.push(["recovery_plan_created", { mode }]);
  }
  for (const g of p.upsert.goals ?? []) if (g.createdAt === g.updatedAt) out.push(["goal_created", { mode, kind: g.kind }]);
  return out;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => emptySnapshot("UTC", new Date(0).toISOString()));
  const [user, setUser] = useState<SessionUser | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [upgrade, setUpgrade] = useState<{ reason: string } | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [loadKey, setLoadKey] = useState(0);

  const snapRef = useRef(snapshot);
  const repoRef = useRef<Repo | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const set = useCallback((s: Snapshot) => {
    snapRef.current = s;
    setSnapshot(s);
  }, []);

  const makeCtx = useCallback((): Ctx => ({ now: new Date(), id: uuid, timezone: safeTimeZone(snapRef.current.preferences.timezone) }), []);

  const commit = useCallback(async (patch: Patch) => {
    const repo = repoRef.current;
    if (!repo || isPatchEmpty(patch)) return;
    const job = queue.current.then(() => withTimeout(repo.commit(patch), SAVE_TIMEOUT_MS, "Saving is taking too long. Check your connection."));
    queue.current = job.catch(() => {});
    await job;
  }, []);

  /* ─────────────── load (guest or account, with guest import) ─────────────── */
  useEffect(() => {
    let cancelled = false;
    const sb = getBrowserSupabase();
    const tzDevice = deviceTimeZone();

    async function load() {
      setStatus("loading");
      setError(null);
      const { kv, persistent: canPersist } = browserKV();
      setPersistent(canPersist);

      let sessionUser: SessionUser | null = null;
      if (sb) {
        const { data } = await sb.auth.getUser();
        if (data.user) sessionUser = { id: data.user.id, email: data.user.email ?? null };
      }

      let repo: Repo;
      let snap: Snapshot;
      const pending: Patch[] = [];

      if (sb && sessionUser) {
        repo = new SupabaseRepo(sb, sessionUser.id, tzDevice);
        snap = await repo.load();
        // New account on a device with guest data → bring it across.
        const guest = readGuestSnapshot(kv);
        if (hasGuestData(guest)) {
          const plan = planGuestMigration(guest!, snap);
          await repo.commit(plan.patch);
          snap = applyPatch(snap, plan.patch);
          new LocalRepo(kv, tzDevice).archiveAfterImport(new Date().toISOString().slice(0, 10));
          await sb
            .from("profiles")
            .update({ signup_source: "guest_conversion", converted_from_guest_at: new Date().toISOString() })
            .eq("id", sessionUser.id)
            .is("converted_from_guest_at", null);
          trackEvent("guest_converted", { count: plan.counts.actions });
          if (!cancelled) toast.show(`Moved ${plan.counts.actions} action${plan.counts.actions === 1 ? "" : "s"} from this device into your account.`, "success");
        }
        if (!snap.preferences.onboardingCompleted && snap.preferences.timezone === "UTC" && tzDevice !== "UTC") {
          pending.push({ upsert: {}, append: {}, preferences: { timezone: tzDevice } });
        }
      } else {
        repo = new LocalRepo(kv, tzDevice);
        snap = await repo.load();
      }

      // Categories for the chosen life areas, then materialise routines and flag misses.
      const now = new Date().toISOString();
      const cats = missingAreaCategories(snap, snap.preferences.lifeAreas, now);
      if (cats.length) pending.push({ upsert: { categories: cats }, append: {} });
      let next = pending.reduce(applyPatch, snap);
      const maint = maintenance(next, { now: new Date(), id: uuid, timezone: safeTimeZone(next.preferences.timezone) });
      next = applyPatch(next, maint);
      const all = mergePatches(...pending, maint);
      if (!isPatchEmpty(all)) await repo.commit(all);

      if (cancelled) return;
      repoRef.current = repo;
      setUser(sessionUser);
      set(next);
      setStatus("ready");
      for (const [name, props] of eventsFromPatch(maint, repo.mode)) trackEvent(name, props);
    }

    withTimeout(load(), LOAD_TIMEOUT_MS).catch((e) => {
      if (cancelled) return;
      console.error("[dogdzi] load failed", e);
      setError(e instanceof RepoError ? e.message : "We couldn't load your actions. Check your connection and try again.");
      setStatus("error");
    });

    const sub = sb?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setLoadKey((k) => k + 1);
    });
    return () => {
      cancelled = true;
      sub?.data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  /* ─────────────── periodic maintenance (missed detection, routines) ─────────────── */
  useEffect(() => {
    if (status !== "ready") return;
    const runMaintenance = () => {
      setTick(Date.now());
      const p = maintenance(snapRef.current, makeCtx());
      if (isPatchEmpty(p)) return;
      set(applyPatch(snapRef.current, p));
      commit(p).catch(() => {});
      for (const [name, props] of eventsFromPatch(p, repoRef.current?.mode ?? "guest")) trackEvent(name, props);
    };
    const id = setInterval(runMaintenance, MAINTENANCE_MS);
    const onVis = () => document.visibilityState === "visible" && runMaintenance();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, commit, makeCtx, set]);

  const mode: DataMode = repoRef.current?.mode ?? (user ? "account" : "guest");

  const allow = useCallback(
    (cap: Capability, ref?: { goalId?: string }) => {
      const r = checkCapability(repoRef.current?.mode ?? "guest", snapRef.current, cap, ref);
      if (!r.ok) setUpgrade({ reason: r.reason });
      return r.ok;
    },
    [],
  );

  const run = useCallback(
    async (op: Op, opts: RunOptions = {}) => {
      if (opts.capability && !allow(opts.capability, opts.capabilityRef)) return false;
      const before = snapRef.current;
      let patch: Patch;
      try {
        patch = op(before, makeCtx());
      } catch (e) {
        toast.show(e instanceof DomainError ? e.message : "That didn't work. Please try again.", "error");
        if (!(e instanceof DomainError)) console.error(e);
        return false;
      }
      if (isPatchEmpty(patch)) return true;
      set(applyPatch(before, patch));
      try {
        await commit(patch);
      } catch (e) {
        // Roll back the optimistic change; nothing is lost from the stored copy.
        set(before);
        toast.show(e instanceof RepoError ? e.message : "Couldn't save that change. Please try again.", "error");
        return false;
      }
      for (const [name, props] of eventsFromPatch(patch, repoRef.current?.mode ?? "guest")) trackEvent(name, props);
      if (opts.success) toast.show(opts.success, "success");
      return true;
    },
    [allow, commit, makeCtx, set, toast],
  );

  const signOut = useCallback(async () => {
    const sb = getBrowserSupabase();
    await sb?.auth.signOut();
    setLoadKey((k) => k + 1);
  }, []);

  const listHistory = useCallback(async (opts: { before?: string; limit?: number }) => {
    const repo = repoRef.current;
    if (!repo) return { events: [], hasMore: false, limited: false };
    return withTimeout(repo.listHistory(opts), LOAD_TIMEOUT_MS);
  }, []);

  const today = useMemo(() => toISODate(new Date(tick), safeTimeZone(snapshot.preferences.timezone)), [tick, snapshot.preferences.timezone]);

  const value = useMemo<DataApi>(
    () => ({
      status,
      error,
      snapshot,
      mode,
      user,
      accountsAvailable: isSupabaseConfigured,
      persistent,
      today,
      run,
      allow,
      upgrade,
      dismissUpgrade: () => setUpgrade(null),
      retry: () => setLoadKey((k) => k + 1),
      signOut,
      listHistory,
    }),
    [status, error, snapshot, mode, user, persistent, today, run, allow, upgrade, signOut, listHistory],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
