/**
 * Calendar view model. Pure: turns a snapshot into what each date shows.
 *
 * Plans are ordinary actions. Occurrences that exist are shown as they are
 * (planned, done, missed, skipped, moved). Repeating plans are only stored a
 * couple of weeks ahead, so dates further out are "projected" from the
 * repeat rule. A projected date becomes a real occurrence with the same
 * deterministic id the scheduler would give it, so it can never be created
 * twice.
 */
import { addDays, parseISODate, toISODate, weekday } from "./dates";
import { deterministicUuid } from "./ids";
import { expandRecurrence } from "./recurrence";
import type { Action, ISODate, Occurrence, Snapshot, UUID } from "./types";

export type CalendarEntry =
  | { kind: "occurrence"; date: ISODate; action: Action; occurrence: Occurrence }
  | { kind: "projected"; date: ISODate; action: Action; id: UUID };

export type DayStatus = "planned" | "done" | "missed" | "skipped" | "moved";

export interface DaySummary {
  planned: number;
  done: number;
  missed: number;
  skipped: number;
  total: number;
}

/** The id a repeating plan's occurrence on `date` has (or will have). */
export const recurrenceOccurrenceId = (actionId: UUID, date: ISODate) => deterministicUuid(`${actionId}:${date}`);

export function entryStatus(e: CalendarEntry): DayStatus {
  if (e.kind === "projected") return "planned";
  const o = e.occurrence;
  if (o.status === "done") return "done";
  if (o.status === "missed") return "missed";
  if (o.status === "skipped") return "skipped";
  if (o.status === "rescheduled") return "moved";
  return "planned";
}

/** 6 weeks × 7 days covering the month of `anchor`, starting on the user's week start. */
export function monthGrid(anchor: ISODate, weekStartsOn: 0 | 1): ISODate[][] {
  const { y, m } = parseISODate(anchor);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const lead = (weekday(first) - weekStartsOn + 7) % 7;
  const start = addDays(first, -lead);
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
}

export function weekDays(anchor: ISODate, weekStartsOn: 0 | 1): ISODate[] {
  const start = addDays(anchor, -((weekday(anchor) - weekStartsOn + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Everything planned or recorded on each date in [from, to].
 * Cancelled occurrences are hidden; moved ones are kept (as "moved") so the
 * original date still tells the truth.
 */
export function calendarEntries(s: Snapshot, from: ISODate, to: ISODate, today: ISODate, timezone: string): Map<ISODate, CalendarEntry[]> {
  const out = new Map<ISODate, CalendarEntry[]>();
  const push = (e: CalendarEntry) => {
    const list = out.get(e.date);
    if (list) list.push(e);
    else out.set(e.date, [e]);
  };
  const actions = new Map(s.actions.map((a) => [a.id, a]));
  const known = new Set<string>();
  for (const o of s.occurrences) {
    if (o.source === "recurrence") known.add(o.id);
    if (o.date < from || o.date > to || o.status === "cancelled") continue;
    const action = actions.get(o.actionId);
    if (action) push({ kind: "occurrence", date: o.date, action, occurrence: o });
  }
  const lo = from > today ? from : today;
  if (lo <= to) {
    for (const a of s.actions) {
      if (a.status !== "active" || !a.recurrence) continue;
      const created = toISODate(new Date(a.createdAt), timezone);
      const start = lo > created ? lo : created;
      for (const d of expandRecurrence(a.recurrence, a.startDate, start, to)) {
        const id = recurrenceOccurrenceId(a.id, d);
        if (!known.has(id)) push({ kind: "projected", date: d, action: a, id });
      }
    }
  }
  for (const list of out.values()) list.sort(compareEntries);
  return out;
}

function compareEntries(a: CalendarEntry, b: CalendarEntry): number {
  const ta = a.kind === "occurrence" ? a.occurrence.time : a.action.time;
  const tb = b.kind === "occurrence" ? b.occurrence.time : b.action.time;
  if (ta && tb && ta !== tb) return ta.localeCompare(tb);
  if (ta && !tb) return -1;
  if (!ta && tb) return 1;
  return a.action.title.localeCompare(b.action.title);
}

export function summarize(entries: CalendarEntry[] | undefined): DaySummary {
  const sum: DaySummary = { planned: 0, done: 0, missed: 0, skipped: 0, total: 0 };
  for (const e of entries ?? []) {
    const st = entryStatus(e);
    if (st === "moved") continue;
    sum[st]++;
    sum.total++;
  }
  return sum;
}

/** Accessible description of a date cell, e.g. "Tuesday 3 November 2026, today, 2 planned, 1 done". */
export function describeDay(date: ISODate, sum: DaySummary, flags: { today: boolean; selected: boolean }): string {
  const { y, m, d } = parseISODate(date);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const parts = [label];
  if (flags.today) parts.push("today");
  if (sum.total === 0) parts.push("nothing planned");
  else {
    if (sum.planned) parts.push(`${sum.planned} planned`);
    if (sum.done) parts.push(`${sum.done} done`);
    if (sum.missed) parts.push(`${sum.missed} missed`);
    if (sum.skipped) parts.push(`${sum.skipped} skipped`);
  }
  return parts.join(", ");
}
