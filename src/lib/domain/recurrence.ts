import { addDays, daysInMonth, diffDays, parseISODate, weekday } from "./dates";
import type { ISODate, Recurrence } from "./types";

const MAX_DATES = 400;

/**
 * Dates on which a recurrence starting at `start` falls, within [from, to]
 * (inclusive). Pure and timezone-free: works on calendar dates only.
 */
export function expandRecurrence(rule: Recurrence, start: ISODate, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const end = rule.until && rule.until < to ? rule.until : to;
  const lo = from > start ? from : start;
  if (lo > end) return out;

  if (rule.freq === "daily") {
    const offset = diffDays(lo, start);
    let k = Math.ceil(offset / interval);
    for (let d = addDays(start, k * interval); d <= end && out.length < MAX_DATES; k++, d = addDays(start, k * interval)) {
      out.push(d);
    }
    return out;
  }

  if (rule.freq === "weekly") {
    const days = rule.byWeekday && rule.byWeekday.length ? new Set(rule.byWeekday) : new Set([weekday(start)]);
    // Week index is counted from the Sunday on/before the start date.
    const startWeekAnchor = addDays(start, -weekday(start));
    for (let d = lo; d <= end && out.length < MAX_DATES; d = addDays(d, 1)) {
      if (!days.has(weekday(d))) continue;
      const weekIndex = Math.floor(diffDays(d, startWeekAnchor) / 7);
      if (weekIndex % interval === 0) out.push(d);
    }
    return out;
  }

  const s = parseISODate(start);
  if (rule.freq === "yearly") {
    // Same month and day each N years; 29 February falls on the 28th in other years.
    for (let k = 0; ; k++) {
      const y = s.y + k * interval;
      const d = Math.min(s.d, daysInMonth(y, s.m));
      const iso = `${y}-${String(s.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (iso > end || out.length >= MAX_DATES) break;
      if (iso >= lo) out.push(iso);
    }
    return out;
  }

  // monthly: same day-of-month as start, clamped to month length (31st → 30th/28th).
  let monthIndex = 0;
  for (;;) {
    const total = s.m - 1 + monthIndex * interval;
    const y = s.y + Math.floor(total / 12);
    const m = (total % 12) + 1;
    const d = Math.min(s.d, daysInMonth(y, m));
    const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso > end || out.length >= MAX_DATES) break;
    if (iso >= lo) out.push(iso);
    monthIndex++;
  }
  return out;
}

export function describeRecurrence(rule: Recurrence | null): string {
  if (!rule) return "Does not repeat";
  const n = rule.interval > 1 ? rule.interval : 0;
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  switch (rule.freq) {
    case "daily":
      return n ? `Every ${n} days` : "Every day";
    case "weekly": {
      const days = (rule.byWeekday ?? []).slice().sort().map((d) => names[d]);
      const base = n ? `Every ${n} weeks` : "Weekly";
      if (days.length === 7) return n ? `${base}, every day` : "Every day";
      if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => rule.byWeekday?.includes(d))) return n ? `${base} on weekdays` : "Weekdays";
      return days.length ? `${base} on ${days.join(", ")}` : base;
    }
    case "monthly":
      return n ? `Every ${n} months` : "Monthly";
    case "yearly":
      return n ? `Every ${n} years` : "Every year";
  }
}
