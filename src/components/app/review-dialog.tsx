"use client";

import { useState } from "react";
import { respond, type ResponseOutcome } from "@/lib/domain/actions";
import { RECOVERY_SUGGESTIONS, REASON_LABELS, reviewAcknowledgement } from "@/lib/domain/copy";
import { addDays, formatDateLabel, formatTime } from "@/lib/domain/dates";
import { REASON_CODES, type Occurrence, type ReasonCode } from "@/lib/domain/types";
import { IconCheck, IconLifebuoy, IconLock, IconMove, IconX, IconSpark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useData } from "./data-provider";

/**
 * The accountability step. Asks what got in the way (no blame), then what
 * happens next: do it now, move it, plan a recovery, let it go, or cancel.
 * Everything is recorded in history.
 */
export function ReviewDialog({ occurrence, trigger, onClose }: { occurrence: Occurrence; trigger: "missed" | "skipped"; onClose: () => void }) {
  const { snapshot, today, run, mode, allow } = useData();
  const action = snapshot.actions.find((a) => a.id === occurrence.actionId);
  const [step, setStep] = useState<1 | 2>(1);
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<ResponseOutcome | null>(null);
  const [date, setDate] = useState(addDays(today, 1));
  const [time, setTime] = useState(occurrence.time ?? "");
  const [steps, setSteps] = useState<string[]>([]);
  const [restart, setRestart] = useState(addDays(today, 1));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isRoutine = !!action?.recurrence;
  const options: { value: ResponseOutcome; label: string; hint: string; icon: React.ReactNode; locked?: boolean }[] = [
    ...(trigger === "missed" ? [{ value: "complete_now" as const, label: "I've done it now", hint: "Mark it complete. It's recorded as done later.", icon: <IconCheck size={18} /> }] : []),
    { value: "reschedule", label: "Reschedule", hint: "Pick a new time. The original stays in your history.", icon: <IconMove size={18} /> },
    { value: "recovery_plan", label: "Make a recovery plan", hint: "Small steps to get back on track.", icon: <IconLifebuoy size={18} />, locked: mode === "guest" },
    { value: "acknowledge", label: isRoutine ? "Let this one go" : "Note it and move on", hint: isRoutine ? "Your routine continues as normal." : "Keeps the record without rescheduling.", icon: <IconSpark size={18} /> },
    { value: "cancel", label: isRoutine ? "Cancel this day" : "Cancel the action", hint: isRoutine ? "Only this occurrence is cancelled." : "Stop pursuing it. It stays in your history.", icon: <IconX size={18} /> },
  ];

  const pickOutcome = (o: ResponseOutcome, locked?: boolean) => {
    if (locked) {
      allow("recovery_plan");
      return;
    }
    setOutcome(o);
    setError(null);
    if (o === "recovery_plan" && steps.length === 0) setSteps([...(RECOVERY_SUGGESTIONS[reason ?? "other"] ?? []), ""]);
  };

  const submit = async () => {
    if (!reason || !outcome) return;
    if (outcome === "reschedule" && (!date || date < today)) return setError("Choose today or a later date.");
    if (outcome === "recovery_plan" && steps.every((s) => !s.trim())) return setError("Add at least one step.");
    setSaving(true);
    const ok = await run(
      (s, ctx) =>
        respond(
          s,
          occurrence.id,
          {
            trigger,
            reasonCode: reason,
            note: note.trim() || null,
            outcome,
            reschedule: outcome === "reschedule" ? { date, time: time || null } : undefined,
            recovery: outcome === "recovery_plan" ? { title: "", steps, restartDate: restart || null } : undefined,
          },
          ctx,
        ),
      { success: reviewAcknowledgement(outcome === "complete_now" ? "completed_late" : outcome === "reschedule" ? "rescheduled" : outcome === "recovery_plan" ? "recovery_plan" : outcome === "cancel" ? "cancelled" : "acknowledged") },
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={trigger === "missed" ? "Let's review this one" : "Skip this action"}
      description={
        action ? (
          <>
            <span className="font-semibold text-fg">{action.title}</span> · {formatDateLabel(occurrence.date, today)}
            {occurrence.time ? `, ${formatTime(occurrence.time)}` : ""}
          </>
        ) : undefined
      }
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Not now
            </Button>
            <Button disabled={!reason} onClick={() => setStep(2)}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button disabled={!outcome} loading={saving} onClick={submit}>
              Save
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {trigger === "missed" ? "It happens. Knowing what got in the way helps you plan better next time." : "No problem. A quick note on why helps you spot patterns later."}
          </p>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What got in the way?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {REASON_CODES.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer items-center rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    reason === r ? "border-primary bg-primary text-primary-fg" : "border-line hover:bg-surface-2",
                  )}
                >
                  <input type="radio" name="reason" className="sr-only" checked={reason === r} onChange={() => setReason(r)} />
                  {REASON_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Anything to add?" optional hint="Private to you.">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Meeting ran over" />}
          </Field>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What would you like to do?</legend>
            <div className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                    outcome === o.value ? "border-primary bg-surface-2" : "border-line hover:bg-surface-2",
                  )}
                >
                  <input type="radio" name="outcome" className="sr-only" checked={outcome === o.value} onChange={() => pickOutcome(o.value, o.locked)} />
                  <span className={cn("mt-0.5 rounded-lg p-1.5", outcome === o.value ? "bg-primary text-primary-fg" : "bg-surface-2 text-forest-500")}>{o.icon}</span>
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {o.label} {o.locked && <IconLock size={14} className="text-muted" aria-label="Requires account" />}
                    </span>
                    <span className="block text-xs text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {outcome === "reschedule" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4">
              <Field label="New date">{({ id }) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
              <Field label="Time" optional>
                {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
              </Field>
            </div>
          )}

          {outcome === "recovery_plan" && (
            <div className="space-y-3 rounded-xl bg-surface-2 p-4">
              <p className="text-sm font-semibold">Recovery steps</p>
              {steps.map((st, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs font-bold text-muted">{i + 1}</span>
                  <Input
                    aria-label={`Step ${i + 1}`}
                    value={st}
                    maxLength={200}
                    placeholder="Add a step"
                    onChange={(e) => {
                      const next = steps.slice();
                      next[i] = e.target.value;
                      if (i === steps.length - 1 && e.target.value && steps.length < 12) next.push("");
                      setSteps(next);
                    }}
                  />
                </div>
              ))}
              <Field label="Restart on" hint="We'll put it back on your list for that day.">
                {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="date" min={today} value={restart} onChange={(e) => setRestart(e.target.value)} />}
              </Field>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-missed">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
