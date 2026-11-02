"use client";

import Link from "next/link";
import { reviewQueue } from "@/lib/domain/actions";
import { routineStreak } from "@/lib/domain/insights";
import { ActionList, sortByTime } from "@/components/app/action-item";
import { useComposer } from "@/components/app/composer";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { IconArrowRight, IconPlus, IconToday } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Card, ProgressRing, SectionTitle } from "@/components/ui/surface";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  return (
    <DataGate skeleton={<DashboardSkeleton />}>
      {() => <Today />}
    </DataGate>
  );
}

function Today() {
  const { snapshot, today } = useData();
  const composer = useComposer();
  const todays = snapshot.occurrences.filter((o) => o.date === today && o.status !== "rescheduled" && o.status !== "cancelled").sort(sortByTime);
  const open = todays.filter((o) => o.status === "pending");
  const done = todays.filter((o) => o.status === "done");
  const other = todays.filter((o) => o.status !== "pending" && o.status !== "done");
  const review = reviewQueue(snapshot);
  const decided = todays.length - open.length;
  const routines = snapshot.actions.filter((a) => a.status === "active" && a.recurrence);
  const bestStreak = routines.reduce((m, a) => Math.max(m, routineStreak(snapshot, a.id, today)), 0);
  const dateLabel = new Date(today + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="animate-fade-in">
      <header className="mb-6">
        <p className="text-sm font-semibold text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{greeting()}.</h1>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 p-3 sm:p-4">
          <ProgressRing value={todays.length ? done.length / todays.length : 0} size={52} label="Today's progress" />
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Today</p>
            <p className="text-sm font-bold">
              {done.length}/{todays.length} done
            </p>
          </div>
        </Card>
        <Link href="/app/review" className="rounded-2xl border border-line bg-surface p-3 transition-colors hover:bg-surface-2 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">To review</p>
          <p className={review.length ? "mt-1 text-2xl font-bold text-missed" : "mt-1 text-2xl font-bold"}>{review.length}</p>
        </Link>
        <Card className="p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Best streak</p>
          <p className="mt-1 text-2xl font-bold">
            {bestStreak}
            <span className="ml-1 text-sm font-semibold text-muted">{bestStreak === 1 ? "day" : "days"}</span>
          </p>
        </Card>
      </div>

      {review.length > 0 && (
        <Link
          href="/app/review"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-missed/30 bg-missed-bg px-4 py-3.5 text-sm transition-colors hover:border-missed/50"
        >
          <span className="flex-1">
            <span className="font-bold text-fg">
              {review.length} {review.length === 1 ? "action needs" : "actions need"} a quick review.
            </span>{" "}
            <span className="text-muted">Note what happened and choose what&apos;s next.</span>
          </span>
          <IconArrowRight size={18} className="text-missed" />
        </Link>
      )}

      {todays.length === 0 ? (
        <EmptyState
          icon={<IconToday />}
          title="Nothing planned for today"
          body="Add one thing you want to get done. Small and specific works best."
          action={
            <Button onClick={() => composer.newAction({ date: today })}>
              <IconPlus size={18} /> Add an action
            </Button>
          }
        />
      ) : (
        <>
          <SectionTitle count={open.length}>To do</SectionTitle>
          {open.length ? (
            <ActionList items={open} />
          ) : (
            <p className="rounded-2xl bg-done-bg px-4 py-3 text-sm font-semibold text-done">
              {decided === todays.length ? "Everything for today is handled. Well done." : "All clear."}
            </p>
          )}
          {done.length > 0 && (
            <>
              <SectionTitle count={done.length}>Done</SectionTitle>
              <ActionList items={done} />
            </>
          )}
          {other.length > 0 && (
            <>
              <SectionTitle count={other.length}>Skipped or missed</SectionTitle>
              <ActionList items={other} />
            </>
          )}
        </>
      )}
    </div>
  );
}
