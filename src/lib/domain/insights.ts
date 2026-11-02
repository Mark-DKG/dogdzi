import { addDays, weekday } from "./dates";
import type { ISODate, ReasonCode, Snapshot, UUID } from "./types";

export interface PeriodStats {
  scheduled: number;
  done: number;
  completedLate: number;
  missed: number;
  skipped: number;
  open: number;
  /** done / (scheduled − still open), 0–1. Null when nothing has been decided yet. */
  followThrough: number | null;
}

/** Stats for occurrences dated within [from, to]. Rescheduled/cancelled entries aren't counted twice. */
export function periodStats(s: Snapshot, from: ISODate, to: ISODate): PeriodStats {
  const st: PeriodStats = { scheduled: 0, done: 0, completedLate: 0, missed: 0, skipped: 0, open: 0, followThrough: null };
  for (const o of s.occurrences) {
    if (o.date < from || o.date > to) continue;
    if (o.status === "cancelled" || (o.status === "rescheduled" && o.resolution === null)) continue;
    st.scheduled++;
    if (o.status === "done") {
      st.done++;
      if (o.resolution === "completed_late") st.completedLate++;
    } else if (o.status === "missed") st.missed++;
    else if (o.status === "skipped") st.skipped++;
    else if (o.status === "pending") st.open++;
  }
  const decided = st.scheduled - st.open;
  st.followThrough = decided > 0 ? st.done / decided : null;
  return st;
}

/** Consecutive scheduled days completed, counting back from today. An open today doesn't break it. */
export function routineStreak(s: Snapshot, actionId: UUID, today: ISODate): number {
  const occ = s.occurrences
    .filter((o) => o.actionId === actionId && o.date <= today && o.status !== "cancelled" && o.status !== "rescheduled")
    .sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const o of occ) {
    if (o.date === today && o.status === "pending") continue;
    if (o.status === "done") streak++;
    else break;
  }
  return streak;
}

export function reasonBreakdown(s: Snapshot, since: ISODate): { reason: ReasonCode; count: number }[] {
  const counts = new Map<ReasonCode, number>();
  for (const r of s.responses) {
    if (r.createdAt.slice(0, 10) < since) continue;
    counts.set(r.reasonCode, (counts.get(r.reasonCode) ?? 0) + 1);
  }
  return Array.from(counts, ([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

export function categoryBreakdown(s: Snapshot, from: ISODate, to: ISODate) {
  const actionCat = new Map(s.actions.map((a) => [a.id, a.categoryId]));
  const rows = new Map<string | null, { done: number; total: number }>();
  for (const o of s.occurrences) {
    if (o.date < from || o.date > to || o.status === "pending" || o.status === "cancelled" || o.status === "rescheduled") continue;
    const c = actionCat.get(o.actionId) ?? null;
    const r = rows.get(c) ?? { done: 0, total: 0 };
    r.total++;
    if (o.status === "done") r.done++;
    rows.set(c, r);
  }
  return Array.from(rows, ([categoryId, v]) => ({ categoryId, ...v, rate: v.total ? v.done / v.total : 0 })).sort((a, b) => b.total - a.total);
}

/** Completion counts per day for the last `days` days ending today (oldest first). */
export function dailySeries(s: Snapshot, today: ISODate, days: number) {
  const out: { date: ISODate; done: number; missed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ date: addDays(today, -i), done: 0, missed: 0 });
  const idx = new Map(out.map((d, i) => [d.date, i]));
  for (const o of s.occurrences) {
    const i = idx.get(o.date);
    if (i === undefined) continue;
    if (o.status === "done") out[i].done++;
    else if (o.status === "missed" || o.status === "skipped") out[i].missed++;
  }
  return out;
}

export function bestWeekday(s: Snapshot, from: ISODate, to: ISODate): { day: number; rate: number } | null {
  const agg = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));
  for (const o of s.occurrences) {
    if (o.date < from || o.date > to || o.status === "pending" || o.status === "cancelled" || o.status === "rescheduled") continue;
    const w = weekday(o.date);
    agg[w].total++;
    if (o.status === "done") agg[w].done++;
  }
  let best: { day: number; rate: number } | null = null;
  agg.forEach((a, day) => {
    if (a.total < 3) return;
    const rate = a.done / a.total;
    if (!best || rate > best.rate) best = { day, rate };
  });
  return best;
}

export function goalProgress(s: Snapshot, goalId: UUID) {
  const ms = s.milestones.filter((m) => m.goalId === goalId);
  const done = ms.filter((m) => m.status === "done").length;
  const actionIds = new Set(s.actions.filter((a) => a.goalId === goalId).map((a) => a.id));
  const occ = s.occurrences.filter((o) => actionIds.has(o.actionId));
  const actionsDone = occ.filter((o) => o.status === "done").length;
  const actionsOpen = occ.filter((o) => o.status === "pending").length;
  return { milestones: ms.length, milestonesDone: done, ratio: ms.length ? done / ms.length : 0, actionsDone, actionsOpen };
}
