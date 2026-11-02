import { addDays, isInQuietHours, minutesOfDay, toHHMM, toISODate, zonedToUtc } from "./dates";
import { missedAfter } from "./actions";
import type { Action, HHMM, Occurrence, Preferences, ReminderStyle } from "./types";

export type ReminderKind = "before" | "due" | "followup" | "day";

export interface PlannedReminder {
  /** Stable key for de-duplication: occurrence + kind + minute. */
  key: string;
  occurrenceId: string;
  actionId: string;
  at: Date;
  kind: ReminderKind;
  title: string;
  body: string;
}

interface StyleRule {
  /** Minutes before due, used when the action has no custom offsets. */
  defaultOffsets: number[];
  /** Minutes after due, sent only while the action is still open. */
  followups: number[];
  /** Local times for follow-ups on untimed actions. */
  dayFollowups: HHMM[];
  /** Hard cap per occurrence. */
  maxPerOccurrence: number;
}

export const STYLE_RULES: Record<ReminderStyle, StyleRule> = {
  gentle: { defaultOffsets: [], followups: [], dayFollowups: [], maxPerOccurrence: 1 },
  standard: { defaultOffsets: [15], followups: [], dayFollowups: [], maxPerOccurrence: 2 },
  firm: { defaultOffsets: [30], followups: [30], dayFollowups: ["18:00"], maxPerOccurrence: 3 },
  persistent: { defaultOffsets: [60, 15], followups: [20, 45, 90], dayFollowups: ["13:00", "18:00"], maxPerOccurrence: 6 },
};

export const STYLE_DESCRIPTIONS: Record<ReminderStyle, string> = {
  gentle: "One quiet nudge when it's time.",
  standard: "A heads-up beforehand and one at the time.",
  firm: "Heads-up, on-time reminder and one follow-up if it's still open.",
  persistent: "Several reminders and follow-ups until you mark it done or move it.",
};

const COPY: Record<ReminderStyle, Record<ReminderKind, (t: string, when: string) => string>> = {
  gentle: {
    before: (t, w) => `When you're ready: ${t} (${w})`,
    due: (t) => `When you're ready: ${t}`,
    followup: (t) => `${t} is still open. No rush.`,
    day: (t) => `On today's list: ${t}`,
  },
  standard: {
    before: (t, w) => `Coming up at ${w}: ${t}`,
    due: (t) => `It's time: ${t}`,
    followup: (t) => `Still open: ${t}`,
    day: (t) => `Today: ${t}`,
  },
  firm: {
    before: (t, w) => `Get ready, ${t} starts at ${w}`,
    due: (t) => `Now: ${t}. Let's get it done.`,
    followup: (t) => `${t} is still open. Do it now, or move it to a time that works.`,
    day: (t) => `Today's commitment: ${t}`,
  },
  persistent: {
    before: (t, w) => `${t} at ${w}. Get set.`,
    due: (t) => `Now: ${t}`,
    followup: (t) => `Checking in: ${t} is still open. Mark it done or reschedule.`,
    day: (t) => `Don't forget today: ${t}`,
  },
};

export function reminderText(style: ReminderStyle, kind: ReminderKind, title: string, when: string): string {
  return COPY[style][kind](title, when);
}

const DAY_START: HHMM = "08:00";

/**
 * Plan every reminder for one occurrence, honouring the user's style and
 * quiet hours. Reminders that fall in quiet hours move to the end of quiet
 * hours, or are dropped if that would be after the action counts as missed.
 */
export function planReminders(o: Occurrence, a: Action, prefs: Preferences): PlannedReminder[] {
  if (o.status !== "pending" || a.status !== "active" || !a.remindersEnabled) return [];
  const tz = prefs.timezone;
  const style = prefs.reminderStyle;
  const rule = STYLE_RULES[style];
  const deadline = missedAfter(o, tz, a.durationMin);
  const raw: { at: Date; kind: ReminderKind }[] = [];

  if (o.time) {
    const due = zonedToUtc(o.date, o.time, tz);
    let offsets = a.reminderOffsets.length ? a.reminderOffsets : rule.defaultOffsets;
    if (style === "gentle") offsets = offsets.length ? [Math.min(...offsets)] : [];
    for (const m of offsets) if (m > 0) raw.push({ at: new Date(due.getTime() - m * 60000), kind: "before" });
    if (!(style === "gentle" && offsets.length)) raw.push({ at: due, kind: "due" });
    for (const m of rule.followups) raw.push({ at: new Date(due.getTime() + m * 60000), kind: "followup" });
  } else {
    const startHHMM = minutesOfDay(prefs.quietEnd) > minutesOfDay(DAY_START) ? prefs.quietEnd : DAY_START;
    raw.push({ at: zonedToUtc(o.date, startHHMM, tz), kind: "day" });
    for (const t of rule.dayFollowups) raw.push({ at: zonedToUtc(o.date, t, tz), kind: "followup" });
  }

  const out: PlannedReminder[] = [];
  const seen = new Set<string>();
  for (const r of raw.sort((x, y) => x.at.getTime() - y.at.getTime())) {
    const at = deferForQuietHours(r.at, prefs);
    if (!at || at >= deadline) continue;
    const key = `${o.id}:${r.kind}:${Math.floor(at.getTime() / 60000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const when = o.time ?? "";
    out.push({ key, occurrenceId: o.id, actionId: a.id, at, kind: r.kind, title: "DOGDZI", body: reminderText(style, r.kind, a.title, formatWhen(when)) });
  }
  // Cap per occurrence, keeping the on-time reminder first, then return in time order.
  const custom = o.time ? a.reminderOffsets.length : 0;
  const cap = Math.max(rule.maxPerOccurrence, style === "gentle" ? 1 : custom + 1);
  const rank: Record<ReminderKind, number> = { due: 0, day: 0, before: 1, followup: 2 };
  return out
    .slice()
    .sort((x, y) => rank[x.kind] - rank[y.kind] || x.at.getTime() - y.at.getTime())
    .slice(0, cap)
    .sort((x, y) => x.at.getTime() - y.at.getTime());
}

function formatWhen(t: string): string {
  if (!t) return "today";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

/** Returns the reminder time, moved out of quiet hours, or null if it can't be. */
export function deferForQuietHours(at: Date, prefs: Pick<Preferences, "timezone" | "quietStart" | "quietEnd">): Date | null {
  const tz = prefs.timezone;
  const local = toHHMM(at, tz);
  if (!isInQuietHours(local, prefs.quietStart, prefs.quietEnd)) return at;
  const date = toISODate(at, tz);
  const sameDayEnd = zonedToUtc(date, prefs.quietEnd, tz);
  if (sameDayEnd > at) return sameDayEnd;
  return zonedToUtc(addDays(date, 1), prefs.quietEnd, tz);
}

/** Reminders due in the window (from, to]. */
export function dueInWindow(plans: PlannedReminder[], from: Date, to: Date): PlannedReminder[] {
  return plans.filter((p) => p.at > from && p.at <= to);
}

/**
 * Enforce the daily notification limit. `sentToday` counts notifications
 * already delivered today. On-time reminders win over follow-ups.
 */
export function applyDailyCap(candidates: PlannedReminder[], sentToday: number, max: number): PlannedReminder[] {
  const room = Math.max(0, max - sentToday);
  const rank: Record<ReminderKind, number> = { due: 0, day: 1, before: 2, followup: 3 };
  return candidates
    .slice()
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.at.getTime() - b.at.getTime())
    .slice(0, room);
}
