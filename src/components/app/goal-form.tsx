"use client";

import { useState } from "react";
import { createGoal, updateGoal } from "@/lib/domain/actions";
import { GUEST_LIMITS } from "@/lib/domain/limits";
import type { GoalKind } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ChoiceChips, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useData } from "./data-provider";

export function GoalForm({ open, onClose, editId, onCreated }: { open: boolean; onClose: () => void; editId?: string; onCreated?: (id: string) => void }) {
  const { snapshot, run, mode, today } = useData();
  const existing = editId ? snapshot.goals.find((g) => g.id === editId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<GoalKind>(existing?.kind ?? "goal");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [milestones, setMilestones] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const maxMilestones = mode === "guest" ? GUEST_LIMITS.maxMilestonesPerGoal : 20;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a name.");
    setError(null);
    setSaving(true);
    let createdId: string | undefined;
    const ok = existing
      ? await run((s, ctx) => updateGoal(s, existing.id, { title, kind, description: description || null, targetDate: targetDate || null, categoryId: categoryId || null }, ctx), { success: "Saved" })
      : await run(
          (s, ctx) => {
            const p = createGoal(s, { title, kind, description, targetDate: targetDate || null, categoryId: categoryId || null, milestones: milestones.slice(0, maxMilestones).map((m) => ({ title: m })) }, ctx);
            createdId = p.upsert.goals?.[0]?.id;
            return p;
          },
          { capability: "create_goal", success: kind === "project" ? "Project created" : "Goal created" },
        );
    setSaving(false);
    if (ok) {
      onClose();
      if (createdId) onCreated?.(createdId);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "Edit" : "New goal or project"}
      description={existing ? undefined : "A goal is an outcome. A project is a set of work. Both get a roadmap of milestones."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="goal-form" loading={saving}>
            {existing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form id="goal-form" onSubmit={submit} className="space-y-5" noValidate>
        <ChoiceChips
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: "goal", label: "Goal" },
            { value: "project", label: "Project" },
          ]}
        />
        <Field label="Name" error={error}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder={kind === "goal" ? "e.g. Run a 10K" : "e.g. Renovate the kitchen"} autoFocus />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Target date" optional>
            {({ id }) => <Input id={id} type="date" min={existing ? undefined : today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />}
          </Field>
          <Field label="Life area" optional>
            {({ id }) => (
              <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">None</option>
                {snapshot.categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Why it matters" optional hint="A sentence to come back to when motivation dips.">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />}
        </Field>
        {!existing && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Milestones <span className="font-normal text-muted">(optional, add more later)</span></legend>
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs font-bold text-muted">{i + 1}</span>
                <Input
                  aria-label={`Milestone ${i + 1}`}
                  value={m}
                  maxLength={140}
                  placeholder={i === 0 ? "First milestone" : "Next milestone"}
                  onChange={(e) => {
                    const next = milestones.slice();
                    next[i] = e.target.value;
                    if (i === milestones.length - 1 && e.target.value && milestones.length < maxMilestones) next.push("");
                    setMilestones(next);
                  }}
                />
              </div>
            ))}
            {mode === "guest" && <p className="text-xs text-muted">Guest roadmaps have up to {GUEST_LIMITS.maxMilestonesPerGoal} milestones.</p>}
          </fieldset>
        )}
      </form>
    </Dialog>
  );
}
