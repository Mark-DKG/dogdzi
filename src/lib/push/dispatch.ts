/**
 * Server reminder selection: which push notifications to send right now for
 * one user. Pure — the cron route supplies data and does the I/O.
 */
import { addDays, toISODate } from "@/lib/domain/dates";
import { applyDailyCap, dueInWindow, planReminders, type PlannedReminder } from "@/lib/domain/reminders";
import type { Action, Occurrence, Preferences } from "@/lib/domain/types";

export interface DispatchInput {
  now: Date;
  /** Only reminders scheduled after this instant are considered (covers cron gaps). */
  windowStart: Date;
  prefs: Preferences;
  actions: Action[];
  occurrences: Occurrence[];
  /** dedupe keys already delivered */
  alreadySent: ReadonlySet<string>;
  /** notifications delivered so far today (user's local day) */
  sentToday: number;
}

export function datesToScan(now: Date, tz: string): string[] {
  const t = toISODate(now, tz);
  return [addDays(t, -1), t, addDays(t, 1)];
}

export function selectReminders(input: DispatchInput): PlannedReminder[] {
  if (!input.prefs.pushEnabled) return [];
  const byId = new Map(input.actions.map((a) => [a.id, a]));
  const candidates: PlannedReminder[] = [];
  for (const o of input.occurrences) {
    const a = byId.get(o.actionId);
    if (!a) continue;
    for (const r of dueInWindow(planReminders(o, a, input.prefs), input.windowStart, input.now)) {
      if (!input.alreadySent.has(r.key)) candidates.push(r);
    }
  }
  return applyDailyCap(candidates, input.sentToday, input.prefs.maxNotificationsPerDay);
}
