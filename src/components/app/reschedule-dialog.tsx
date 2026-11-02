"use client";

import { useState } from "react";
import { rescheduleOccurrence } from "@/lib/domain/actions";
import { addDays } from "@/lib/domain/dates";
import type { Occurrence } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useData } from "./data-provider";

export function RescheduleDialog({ occurrence, onClose }: { occurrence: Occurrence; onClose: () => void }) {
  const { snapshot, today, run } = useData();
  const action = snapshot.actions.find((a) => a.id === occurrence.actionId);
  const [date, setDate] = useState(occurrence.date < today ? today : addDays(occurrence.date, 1));
  const [time, setTime] = useState(occurrence.time ?? "");
  const [saving, setSaving] = useState(false);
  const quick = [
    { label: "Later today", date: today },
    { label: "Tomorrow", date: addDays(today, 1) },
    { label: "Next week", date: addDays(today, 7) },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run((s, ctx) => rescheduleOccurrence(s, occurrence.id, date, time || null, ctx), { success: "Moved. The original stays in your history." });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reschedule"
      description={action?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reschedule-form" loading={saving}>
            Move it
          </Button>
        </>
      }
    >
      <form id="reschedule-form" onSubmit={save} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <Button key={q.label} variant={date === q.date ? "primary" : "secondary"} size="sm" onClick={() => setDate(q.date)}>
              {q.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New date">{({ id }) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />}</Field>
          <Field label="Time" optional>
            {({ id }) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
