"use client";

import { useMemo, useState } from "react";
import { cancelAction, createAction, updateAction, type ActionInput } from "@/lib/domain/actions";
import { addMinutesHHMM, minutesOfDay, weekday } from "@/lib/domain/dates";
import { describeRecurrence } from "@/lib/domain/recurrence";
import type { Priority, Recurrence } from "@/lib/domain/types";
import { IconLock } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ChoiceChips, Field, Input, Select, Switch, Textarea, ToggleChips } from "@/components/ui/field";
import { useData } from "./data-provider";

export interface ActionFormPreset {
  date?: string;
  goalId?: string;
  milestoneId?: string;
  repeat?: RepeatChoice;
  /** Calendar wording: "Add plan" instead of "New action". */
  plan?: boolean;
}

type RepeatChoice = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
const WEEKDAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
];
const REMINDER_OPTIONS = [
  { value: "style", label: "Use my reminder style" },
  { value: "0", label: "At the time" },
  { value: "5", label: "5 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

function toRepeat(r: Recurrence | null): RepeatChoice {
  if (!r) return "none";
  if (r.freq === "daily") return "daily";
  if (r.freq === "monthly") return "monthly";
  if (r.freq === "yearly") return "yearly";
  const d = r.byWeekday ?? [];
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return "weekdays";
  return "weekly";
}

export function ActionForm({ open, onClose, editId, preset }: { open: boolean; onClose: () => void; editId?: string; preset?: ActionFormPreset }) {
  const { snapshot, today, run, mode, allow } = useData();
  const existing = editId ? snapshot.actions.find((a) => a.id === editId) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.startDate ?? preset?.date ?? today);
  const [time, setTime] = useState(existing?.time ?? "");
  const [repeat, setRepeat] = useState<RepeatChoice>(existing ? toRepeat(existing.recurrence) : (preset?.repeat ?? "none"));
  const [days, setDays] = useState<string[]>(existing?.recurrence?.byWeekday?.map(String) ?? [String(weekday(preset?.date ?? today))]);
  const [interval, setIntervalN] = useState(existing?.recurrence?.interval ?? 1);
  const [until, setUntil] = useState(existing?.recurrence?.until ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? "normal");
  const [remindersEnabled, setRemindersEnabled] = useState(existing?.remindersEnabled ?? true);
  const [reminder, setReminder] = useState(existing?.reminderOffsets.length ? String(Math.min(...existing.reminderOffsets)) : "style");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [goalId, setGoalId] = useState(existing?.goalId ?? preset?.goalId ?? "");
  const [milestoneId, setMilestoneId] = useState(existing?.milestoneId ?? preset?.milestoneId ?? "");
  const [endTime, setEndTime] = useState(existing?.time && existing.durationMin ? (addMinutesHHMM(existing.time, existing.durationMin) ?? "") : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plan = preset?.plan ?? false;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const categories = snapshot.categories.filter((c) => !c.archived).sort((a, b) => a.position - b.position);
  const goals = snapshot.goals.filter((g) => g.status === "active" || g.id === goalId);
  const milestones = useMemo(() => snapshot.milestones.filter((m) => m.goalId === goalId).sort((a, b) => a.position - b.position), [snapshot.milestones, goalId]);
  const recurringLocked = mode === "guest";
  const typeLocked = !!existing; // one-off ↔ routine can't change after creation

  const recurrence: Recurrence | null = (() => {
    switch (repeat) {
      case "none":
        return null;
      case "daily":
        return { freq: "daily", interval, until: until || null };
      case "weekdays":
        return { freq: "weekly", interval: 1, byWeekday: [1, 2, 3, 4, 5], until: until || null };
      case "weekly":
        return { freq: "weekly", interval, byWeekday: days.map(Number), until: until || null };
      case "monthly":
        return { freq: "monthly", interval, until: until || null };
      case "yearly":
        return { freq: "yearly", interval, until: until || null };
    }
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Give the action a short title.";
    if (!date) errs.date = "Choose a date.";
    else if (!existing && date < today) errs.date = "Plans start today or later.";
    if (repeat === "weekly" && days.length === 0) errs.days = "Pick at least one day.";
    if (until && date && until < date) errs.until = "The end date is before the start.";
    if (endTime && !time) errs.endTime = "Add a start time first.";
    else if (endTime && time && minutesOfDay(endTime) <= minutesOfDay(time)) errs.endTime = "End after the start time.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (recurrence && !existing && !allow("recurrence")) return;

    const input: ActionInput = {
      title,
      notes: notes || null,
      categoryId: categoryId || null,
      priority,
      startDate: date,
      time: time || null,
      durationMin: time && endTime ? minutesOfDay(endTime) - minutesOfDay(time) : time ? null : (existing?.durationMin ?? null),
      recurrence,
      remindersEnabled,
      reminderOffsets: reminder === "style" ? [] : [Number(reminder)],
      goalId: goalId || null,
      milestoneId: milestoneId || null,
    };
    setSaving(true);
    const ok = existing
      ? await run((s, ctx) => updateAction(s, existing.id, existing.recurrence ? input : { ...input, recurrence: undefined }, ctx), { success: "Saved" })
      : await run((s, ctx) => createAction(s, input, ctx), { capability: "create_action", success: plan ? (recurrence ? "Repeating plan added" : "Plan added") : recurrence ? "Routine added" : "Action added" });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? (plan ? "Edit plan" : "Edit action") : plan ? "Add plan" : "New action"}
      description={existing ? undefined : "What will you do, and when?"}
      footer={
        <>
          {existing && existing.status === "active" && (
            <Button variant="ghost" className="mr-auto text-missed" onClick={() => setConfirmDelete(true)}>
              {existing.recurrence ? "Stop repeating" : "Delete"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="action-form" loading={saving}>
            {existing ? "Save changes" : plan ? "Add plan" : "Add action"}
          </Button>
        </>
      }
    >
      <form id="action-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Title" error={errors.title}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Submit the quarterly report" maxLength={140} autoFocus required />
          )}
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={repeat === "none" ? "Date" : "Starts"} error={errors.date}>
            {({ id, describedBy, invalid }) => <Input id={id} type="date" aria-describedby={describedBy} aria-invalid={invalid} value={date} min={existing ? undefined : today} onChange={(e) => setDate(e.target.value)} required />}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start" optional>
              {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
            </Field>
            <Field label="End" optional error={errors.endTime}>
              {({ id, describedBy, invalid }) => <Input id={id} type="time" aria-describedby={describedBy} aria-invalid={invalid} value={endTime} disabled={!time} onChange={(e) => setEndTime(e.target.value)} />}
            </Field>
          </div>
        </div>
        {!time && <p className="-mt-3 text-xs text-muted">No time means any time that day.</p>}

        <div className="space-y-3 rounded-2xl border border-line p-4">
          <Field
            label="Repeat"
            hint={
              typeLocked
                ? "One-off actions and routines can't be switched after creating them."
                : recurringLocked
                  ? "Recurring routines need a free account."
                  : describeRecurrence(recurrence)
            }
          >
            {({ id, describedBy }) => (
              <div className="flex items-center gap-2">
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={repeat}
                  disabled={typeLocked && !existing?.recurrence}
                  onChange={(e) => {
                    const v = e.target.value as RepeatChoice;
                    if (v !== "none" && recurringLocked && !allow("recurrence")) return;
                    if (typeLocked && v === "none") return;
                    setRepeat(v);
                  }}
                >
                  {(!typeLocked || !existing?.recurrence) && <option value="none">Does not repeat</option>}
                  <option value="daily">Every day</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Specific days of the week</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Every year</option>
                </Select>
                {recurringLocked && <IconLock className="shrink-0 text-muted" aria-label="Requires account" />}
              </div>
            )}
          </Field>
          {repeat === "weekly" && (
            <div>
              <ToggleChips label="On" options={WEEKDAYS} values={days} onChange={setDays} />
              {errors.days && <p className="mt-1 text-xs font-medium text-missed">{errors.days}</p>}
            </div>
          )}
          {repeat !== "none" && repeat !== "weekdays" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Every (${repeat === "daily" ? "days" : repeat === "weekly" ? "weeks" : repeat === "yearly" ? "years" : "months"})`}>
                {({ id }) => <Input id={id} type="number" min={1} max={52} value={interval} onChange={(e) => setIntervalN(Math.max(1, Math.min(52, Number(e.target.value) || 1)))} />}
              </Field>
              <Field label="Ends on" optional error={errors.until}>
                {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={until} min={date} onChange={(e) => setUntil(e.target.value)} />}
              </Field>
            </div>
          )}
          {repeat === "weekdays" && (
            <Field label="Ends on" optional error={errors.until}>
              {({ id, invalid }) => <Input id={id} type="date" aria-invalid={invalid} value={until} min={date} onChange={(e) => setUntil(e.target.value)} />}
            </Field>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Life area">
            {({ id }) => (
              <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reminder" hint={!time ? "Untimed actions get a start-of-day reminder." : undefined}>
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={reminder} disabled={!remindersEnabled || !time} onChange={(e) => setReminder(e.target.value)}>
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Switch checked={remindersEnabled} onChange={setRemindersEnabled} label="Remind me" description="Follows your reminder style and quiet hours." />

        <ChoiceChips
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
          ]}
        />

        <details className="group rounded-2xl border border-line p-4" open={!!(goalId || notes)}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-fg">
            More options <span className="font-normal text-muted">· details, goal</span>
          </summary>
          <div className="mt-4 space-y-4">
            {goals.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Goal or project" optional>
                  {({ id }) => (
                    <Select
                      id={id}
                      value={goalId}
                      onChange={(e) => {
                        setGoalId(e.target.value);
                        setMilestoneId("");
                      }}
                    >
                      <option value="">None</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {milestones.length > 0 && (
                  <Field label="Milestone" optional>
                    {({ id }) => (
                      <Select id={id} value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)}>
                        <option value="">None</option>
                        {milestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            )}
            <Field label="Details" optional hint="Private to you. Never sent to analytics.">
              {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />}
            </Field>
          </div>
        </details>
      </form>
      {existing && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={existing.recurrence ? "Stop this repeating plan?" : "Delete this plan?"}
          body={
            existing.recurrence
              ? "Future dates are removed from your calendar. Everything that already happened stays in your history."
              : "It's removed from your calendar. History keeps a note that it was cancelled."
          }
          confirmLabel={existing.recurrence ? "Stop repeating" : "Delete plan"}
          tone="danger"
          onConfirm={() => {
            void run((s, ctx) => cancelAction(s, existing.id, ctx), { success: "Removed. It's still in your history." }).then((ok) => ok && onClose());
          }}
        />
      )}
    </Dialog>
  );
}
