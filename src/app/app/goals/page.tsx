"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateLabel } from "@/lib/domain/dates";
import { goalProgress } from "@/lib/domain/insights";
import type { GoalStatus } from "@/lib/domain/types";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { GoalForm } from "@/components/app/goal-form";
import { IconFlag, IconPlus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { GoalsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Badge, PageHeader, ProgressBar, SectionTitle } from "@/components/ui/surface";

const STATUS_TONE: Record<GoalStatus, "neutral" | "done" | "warn" | "brand"> = { active: "brand", paused: "warn", completed: "done", archived: "neutral" };

export default function GoalsPage() {
  return <DataGate skeleton={<GoalsSkeleton />}>{() => <Goals />}</DataGate>;
}

function Goals() {
  const { snapshot, today, allow } = useData();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const active = snapshot.goals.filter((g) => g.status === "active" || g.status === "paused");
  const finished = snapshot.goals.filter((g) => g.status === "completed" || g.status === "archived");
  const open = () => {
    if (!allow("create_goal")) return;
    setFormKey((k) => k + 1);
    setCreating(true);
  };

  const card = (g: (typeof snapshot.goals)[number]) => {
    const p = goalProgress(snapshot, g.id);
    return (
      <li key={g.id}>
        <Link href={`/app/goals/${g.id}`} className="block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-forest-300">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.kind}</p>
              <h3 className="mt-0.5 truncate text-base font-bold">{g.title}</h3>
            </div>
            <Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar value={p.ratio} label={`${g.title} progress`} />
            <span className="shrink-0 text-xs font-bold tabular-nums">
              {p.milestonesDone}/{p.milestones}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted">
            {p.milestones ? `${p.milestonesDone} of ${p.milestones} milestones` : "No milestones yet"}
            {g.targetDate ? ` · target ${formatDateLabel(g.targetDate, today)}` : ""}
            {p.actionsOpen ? ` · ${p.actionsOpen} open actions` : ""}
          </p>
        </Link>
      </li>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Goals & projects"
        subtitle="Outcomes you're working toward, broken into milestones."
        actions={
          <Button size="sm" onClick={open}>
            <IconPlus size={16} /> New
          </Button>
        }
      />
      {active.length === 0 ? (
        <EmptyState
          icon={<IconFlag />}
          title="No goals yet"
          body="Pick one thing that matters this season. Give it a target date and a few milestones."
          action={
            <Button onClick={open}>
              <IconPlus size={18} /> Create a goal
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">{active.map(card)}</ul>
      )}
      {finished.length > 0 && (
        <>
          <SectionTitle count={finished.length}>Completed & archived</SectionTitle>
          <ul className="grid gap-3 opacity-80 sm:grid-cols-2">{finished.map(card)}</ul>
        </>
      )}
      <GoalForm key={formKey} open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/app/goals/${id}`)} />
    </div>
  );
}
