"use client";

import { addDays, formatDateLabel, formatTime } from "@/lib/domain/dates";
import { routineStreak } from "@/lib/domain/insights";
import { describeRecurrence } from "@/lib/domain/recurrence";
import { ActionList, sortByTime } from "@/components/app/action-item";
import { useComposer } from "@/components/app/composer";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { IconCalendar, IconEdit, IconPlus, IconRepeat } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ActionListSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Badge, PageHeader, SectionTitle } from "@/components/ui/surface";

export default function UpcomingPage() {
  return (
    <DataGate
      skeleton={
        <>
          <PageHeaderSkeleton />
          <ActionListSkeleton rows={6} label="Loading upcoming actions" />
        </>
      }
    >
      {() => <Upcoming />}
    </DataGate>
  );
}

function Upcoming() {
  const { snapshot, today } = useData();
  const composer = useComposer();
  const end = addDays(today, 14);
  const upcoming = snapshot.occurrences.filter((o) => o.status === "pending" && o.date > today).sort(sortByTime);
  const soon = upcoming.filter((o) => o.date <= end);
  const later = upcoming.filter((o) => o.date > end);
  const byDate = new Map<string, typeof soon>();
  for (const o of soon) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  const routines = snapshot.actions.filter((a) => a.status === "active" && a.recurrence);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Upcoming"
        subtitle="The next two weeks, plus your routines."
        actions={
          <Button size="sm" variant="secondary" onClick={() => composer.newAction({ date: addDays(today, 1) })}>
            <IconPlus size={16} /> Plan ahead
          </Button>
        }
      />

      {routines.length > 0 && (
        <section aria-labelledby="routines">
          <SectionTitle count={routines.length}>
            <span id="routines">Routines</span>
          </SectionTitle>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {routines.map((a) => {
              const streak = routineStreak(snapshot, a.id, today);
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-forest-500">
                    <IconRepeat size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted">
                      {describeRecurrence(a.recurrence)} · {formatTime(a.time)}
                    </p>
                  </div>
                  {streak > 0 && <Badge tone="done">{streak}-day streak</Badge>}
                  <button type="button" onClick={() => composer.editAction(a.id)} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Edit ${a.title}`}>
                    <IconEdit size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {soon.length === 0 && later.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<IconCalendar />}
          title="Nothing scheduled yet"
          body="Plan what's coming so future you knows exactly what to do."
          action={
            <Button onClick={() => composer.newAction({ date: addDays(today, 1) })}>
              <IconPlus size={18} /> Plan an action
            </Button>
          }
        />
      ) : (
        Array.from(byDate, ([date, items]) => (
          <section key={date}>
            <SectionTitle count={items.length}>{formatDateLabel(date, today)}</SectionTitle>
            <ActionList items={items} />
          </section>
        ))
      )}

      {later.length > 0 && (
        <section>
          <SectionTitle count={later.length}>Later</SectionTitle>
          <ActionList items={later} showDate />
        </section>
      )}
    </div>
  );
}
