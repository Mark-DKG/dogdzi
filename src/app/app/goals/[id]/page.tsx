"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { addMilestone, moveMilestone, setMilestoneStatus, updateGoal } from "@/lib/domain/actions";
import { formatDateLabel } from "@/lib/domain/dates";
import { goalProgress } from "@/lib/domain/insights";
import type { GoalStatus } from "@/lib/domain/types";
import { ActionList, sortByTime } from "@/components/app/action-item";
import { useComposer } from "@/components/app/composer";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { GoalForm } from "@/components/app/goal-form";
import { IconCheck, IconChevronDown, IconChevronLeft, IconChevronUp, IconEdit, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { RoadmapSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Card, ProgressBar, SectionTitle } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export default function GoalPage() {
  return <DataGate skeleton={<RoadmapSkeleton />}>{() => <Goal />}</DataGate>;
}

function Goal() {
  const params = useParams<{ id: string }>();
  const { snapshot, today, run } = useData();
  const composer = useComposer();
  const [editing, setEditing] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [newDate, setNewDate] = useState("");
  const goal = snapshot.goals.find((g) => g.id === params.id);

  if (!goal) {
    return (
      <EmptyState
        title="Goal not found"
        body="It may have been created on another device that hasn't synced, or the link is wrong."
        action={<Link href="/app/goals" className="font-semibold underline">Back to goals</Link>}
      />
    );
  }

  const progress = goalProgress(snapshot, goal.id);
  const milestones = snapshot.milestones.filter((m) => m.goalId === goal.id).sort((a, b) => a.position - b.position);
  const actionIds = new Set(snapshot.actions.filter((a) => a.goalId === goal.id).map((a) => a.id));
  const openActions = snapshot.occurrences.filter((o) => actionIds.has(o.actionId) && (o.status === "pending" || (o.status === "missed" && !o.resolution))).sort(sortByTime);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestone.trim()) return;
    const ok = await run((s, ctx) => addMilestone(s, goal.id, newMilestone, newDate || null, ctx), { capability: "add_milestone", capabilityRef: { goalId: goal.id } });
    if (ok) {
      setNewMilestone("");
      setNewDate("");
    }
  };
  const setStatus = (status: GoalStatus, msg: string) => void run((s, ctx) => updateGoal(s, goal.id, { status }, ctx), { success: msg });

  return (
    <div className="animate-fade-in">
      <Link href="/app/goals" className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-muted hover:text-fg">
        <IconChevronLeft size={16} /> Goals
      </Link>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {goal.kind} · {goal.status}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{goal.title}</h1>
          {goal.description && <p className="mt-2 max-w-prose text-sm text-muted">{goal.description}</p>}
        </div>
        <Menu
          label="Goal options"
          items={[
            { label: "Edit", icon: <IconEdit size={16} />, onSelect: () => setEditing(true) },
            ...(goal.status !== "active" ? [{ label: "Mark active", onSelect: () => setStatus("active", "Back on") }] : []),
            ...(goal.status === "active" ? [{ label: "Pause", onSelect: () => setStatus("paused", "Paused") }] : []),
            ...(goal.status !== "completed" ? [{ label: "Mark completed", onSelect: () => setStatus("completed", "Completed. Congratulations!") }] : []),
            ...(goal.status !== "archived" ? [{ label: "Archive", onSelect: () => setStatus("archived", "Archived") }] : []),
          ]}
        />
      </header>

      <Card className="mb-8 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Roadmap progress</span>
          <span className="font-bold tabular-nums">{Math.round(progress.ratio * 100)}%</span>
        </div>
        <ProgressBar value={progress.ratio} label="Roadmap progress" className="mt-3" />
        <p className="mt-3 text-xs text-muted">
          {progress.milestonesDone} of {progress.milestones} milestones · {progress.actionsDone} actions done
          {goal.targetDate ? ` · target ${formatDateLabel(goal.targetDate, today)}` : ""}
        </p>
      </Card>

      <SectionTitle count={milestones.length}>Roadmap</SectionTitle>
      {milestones.length === 0 ? (
        <p className="mb-4 text-sm text-muted">Break this into 3–5 milestones. Each one should be something you could tick off.</p>
      ) : (
        <ol className="mb-4">
          {milestones.map((m, i) => {
            const done = m.status === "done";
            const overdue = !done && m.targetDate && m.targetDate < today;
            return (
              <li key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                {i < milestones.length - 1 && <span className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5", done ? "bg-forest-400" : "bg-line")} aria-hidden />}
                <button
                  type="button"
                  onClick={() => void run((s, ctx) => setMilestoneStatus(s, m.id, !done, ctx))}
                  aria-pressed={done}
                  aria-label={done ? `Mark "${m.title}" as not reached` : `Mark "${m.title}" as reached`}
                  className={cn(
                    "tap-44 relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    done ? "border-forest-400 bg-forest-400 text-cream-50" : "border-forest-300 bg-surface text-muted hover:border-forest-500",
                  )}
                >
                  {done ? <IconCheck size={16} strokeWidth={2.6} /> : i + 1}
                </button>
                <div className="min-w-0 flex-1 pt-1">
                  <p className={cn("text-sm font-semibold", done && "text-muted line-through")}>{m.title}</p>
                  <p className={cn("text-xs", overdue ? "font-semibold text-missed" : "text-muted")}>
                    {done && m.completedAt ? `Reached ${formatDateLabel(m.completedAt.slice(0, 10), today)}` : m.targetDate ? `Target ${formatDateLabel(m.targetDate, today)}` : "No target date"}
                  </p>
                  <button
                    type="button"
                    className="-my-1 inline-flex min-h-11 items-center text-xs font-semibold text-forest-500 hover:underline"
                    onClick={() => composer.newAction({ goalId: goal.id, milestoneId: m.id })}
                  >
                    + Add an action for this
                  </button>
                </div>
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => void run((s, ctx) => moveMilestone(s, m.id, -1, ctx))} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30" aria-label={`Move "${m.title}" up`}>
                    <IconChevronUp size={16} />
                  </button>
                  <button type="button" disabled={i === milestones.length - 1} onClick={() => void run((s, ctx) => moveMilestone(s, m.id, 1, ctx))} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30" aria-label={`Move "${m.title}" down`}>
                    <IconChevronDown size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-3 sm:flex-row">
        <Input aria-label="New milestone" placeholder="Add a milestone" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} maxLength={140} className="flex-1" />
        <Input aria-label="Milestone target date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="sm:w-44" />
        <Button type="submit" variant="secondary" disabled={!newMilestone.trim()}>
          <IconPlus size={16} /> Add
        </Button>
      </form>

      <SectionTitle
        count={openActions.length}
        action={
          <Button size="sm" variant="ghost" onClick={() => composer.newAction({ goalId: goal.id })}>
            <IconPlus size={16} /> Action
          </Button>
        }
      >
        Open actions
      </SectionTitle>
      {openActions.length ? <ActionList items={openActions} showDate /> : <p className="text-sm text-muted">No open actions. What&apos;s the next concrete step?</p>}

      <GoalForm key={String(editing)} open={editing} editId={goal.id} onClose={() => setEditing(false)} />
    </div>
  );
}
