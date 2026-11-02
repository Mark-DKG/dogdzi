"use client";

import { REASON_LABELS } from "@/lib/domain/copy";
import { addDays, formatDateLabel } from "@/lib/domain/dates";
import { bestWeekday, categoryBreakdown, dailySeries, periodStats, reasonBreakdown, routineStreak } from "@/lib/domain/insights";
import { useData } from "@/components/app/data-provider";
import { DataGate, LockedPanel } from "@/components/app/gate";
import { AnalyticsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Card, PageHeader, ProgressBar, SectionTitle, Stat } from "@/components/ui/surface";
import { IconChart } from "@/components/icons";
import { percent } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function InsightsPage() {
  return <DataGate skeleton={<AnalyticsSkeleton />}>{() => <Insights />}</DataGate>;
}

function Insights() {
  const { snapshot, today, mode } = useData();
  if (mode === "guest") {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Insights" subtitle="Patterns in how you follow through." />
        <LockedPanel title="Progress insights come with an account" body="Follow-through rates, streaks, what tends to get in the way, and your strongest days, built from your full history." />
      </div>
    );
  }

  const week = periodStats(snapshot, addDays(today, -6), today);
  const month = periodStats(snapshot, addDays(today, -29), today);
  const series = dailySeries(snapshot, today, 14);
  const max = Math.max(1, ...series.map((d) => d.done + d.missed));
  const reasons = reasonBreakdown(snapshot, addDays(today, -29));
  const reasonMax = Math.max(1, ...reasons.map((r) => r.count));
  const cats = categoryBreakdown(snapshot, addDays(today, -29), today);
  const best = bestWeekday(snapshot, addDays(today, -59), today);
  const routines = snapshot.actions
    .filter((a) => a.status === "active" && a.recurrence)
    .map((a) => ({ a, streak: routineStreak(snapshot, a.id, today) }))
    .sort((x, y) => y.streak - x.streak);
  const recoveries = snapshot.recoveryPlans.filter((p) => p.status === "completed").length;

  if (month.scheduled === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Insights" subtitle="Patterns in how you follow through." />
        <EmptyState icon={<IconChart />} title="Not enough data yet" body="After a few days of planning and completing actions, your patterns will show up here." />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Insights" subtitle="Patterns in how you follow through. Use them to plan, not to judge." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Follow-through · 7d" value={percent(week.followThrough)} hint={`${week.done} of ${week.scheduled - week.open} decided`} />
        <Stat label="Follow-through · 30d" value={percent(month.followThrough)} hint={`${month.done} done`} />
        <Stat label="Done later" value={month.completedLate} hint="missed, then completed" />
        <Stat label="Recoveries" value={recoveries} hint="plans completed" />
      </div>

      <SectionTitle>Last 14 days</SectionTitle>
      <Card className="p-5">
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Done and missed actions per day for the last 14 days">
          {series.map((d) => (
            <div key={d.date} className="flex h-full flex-1 flex-col justify-end gap-0.5" title={`${formatDateLabel(d.date, today)}: ${d.done} done, ${d.missed} missed or skipped`}>
              <div className="rounded-t-sm bg-missed/60" style={{ height: `${(d.missed / max) * 100}%` }} />
              <div className="rounded-sm bg-forest-400" style={{ height: `${(d.done / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-forest-400" /> Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-missed/60" /> Missed or skipped
          </span>
          {best && <span className="ml-auto">Strongest day: {DAYS[best.day]}</span>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>What gets in the way · 30d</SectionTitle>
          <Card className="p-5">
            {reasons.length === 0 ? (
              <p className="text-sm text-muted">No reviews recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {reasons.map((r) => (
                  <li key={r.reason}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{REASON_LABELS[r.reason]}</span>
                      <span className="font-bold tabular-nums">{r.count}</span>
                    </div>
                    <ProgressBar value={r.count / reasonMax} label={REASON_LABELS[r.reason]} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
        <section>
          <SectionTitle>By life area · 30d</SectionTitle>
          <Card className="p-5">
            {cats.length === 0 ? (
              <p className="text-sm text-muted">Nothing decided yet in the last 30 days.</p>
            ) : (
              <ul className="space-y-3">
                {cats.map((c) => {
                  const cat = snapshot.categories.find((x) => x.id === c.categoryId);
                  return (
                    <li key={c.categoryId ?? "none"}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat?.color ?? "#7A7466" }} />
                          {cat?.name ?? "No area"}
                        </span>
                        <span className="tabular-nums text-muted">
                          {c.done}/{c.total} · <b className="text-fg">{percent(c.rate)}</b>
                        </span>
                      </div>
                      <ProgressBar value={c.rate} label={cat?.name ?? "No area"} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {routines.length > 0 && (
        <>
          <SectionTitle>Routine streaks</SectionTitle>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {routines.map(({ a, streak }) => (
              <li key={a.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                <span className="truncate text-sm font-semibold">{a.title}</span>
                <span className="text-sm font-bold tabular-nums">
                  {streak} <span className="font-medium text-muted">{streak === 1 ? "day" : "days"}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
