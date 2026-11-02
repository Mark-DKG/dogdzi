"use client";

import { useState } from "react";
import { acknowledgeMany, reviewQueue, setRecoveryStatus, toggleRecoveryStep } from "@/lib/domain/actions";
import { REASON_LABELS } from "@/lib/domain/copy";
import { formatDateLabel, formatTime } from "@/lib/domain/dates";
import { REASON_CODES, type ReasonCode } from "@/lib/domain/types";
import { useComposer } from "@/components/app/composer";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { IconCheck, IconLifebuoy, IconReview } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionListSkeleton, PageHeaderSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { Badge, Card, PageHeader, ProgressBar, SectionTitle } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export default function ReviewPage() {
  return (
    <DataGate
      skeleton={
        <>
          <PageHeaderSkeleton />
          <ActionListSkeleton rows={3} label="Loading review" />
        </>
      }
    >
      {() => <Review />}
    </DataGate>
  );
}

function Review() {
  const { snapshot, today, run } = useData();
  const composer = useComposer();
  const [bulk, setBulk] = useState(false);
  const [bulkReason, setBulkReason] = useState<ReasonCode>("unexpected_event");
  const queue = reviewQueue(snapshot);
  const byId = new Map(snapshot.actions.map((a) => [a.id, a]));
  const routineDays = queue.filter((o) => byId.get(o.actionId)?.recurrence);
  const plans = snapshot.recoveryPlans.filter((p) => p.status === "active").sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Review & recover" subtitle="Missed something? Note what happened, decide what's next, keep going." />

      <SectionTitle
        count={queue.length}
        action={
          routineDays.length > 1 ? (
            <Button size="sm" variant="ghost" onClick={() => setBulk(true)}>
              Let go of {routineDays.length} routine days
            </Button>
          ) : undefined
        }
      >
        Needs review
      </SectionTitle>

      {queue.length === 0 ? (
        <EmptyState icon={<IconCheck />} title="You're all caught up" body="Nothing waiting for review. Missed actions show up here so nothing quietly disappears." />
      ) : (
        <ul className="space-y-2.5">
          {queue.map((o) => {
            const a = byId.get(o.actionId);
            if (!a) return null;
            return (
              <li key={o.id} className="flex items-center gap-3 rounded-2xl border border-missed/30 bg-surface p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-missed-bg text-missed">
                  <IconReview size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{a.title}</p>
                  <p className="text-xs text-muted">
                    {formatDateLabel(o.date, today)} · {formatTime(o.time)}
                    {a.recurrence ? " · routine" : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => composer.review(o, "missed")}>
                  Review
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <SectionTitle count={plans.length}>Recovery plans</SectionTitle>
      {plans.length === 0 ? (
        <p className="text-sm text-muted">When you choose &ldquo;Make a recovery plan&rdquo; during a review, it appears here with its steps.</p>
      ) : (
        <ul className="space-y-3">
          {plans.map((p) => {
            const done = p.steps.filter((s) => s.done).length;
            return (
              <li key={p.id}>
                <Card className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-forest-500">
                      <IconLifebuoy size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold">{p.title}</h3>
                      <p className="text-xs text-muted">
                        {done}/{p.steps.length} steps
                        {p.restartDate ? ` · restart ${formatDateLabel(p.restartDate, today)}` : ""}
                      </p>
                    </div>
                    {done === p.steps.length && <Badge tone="done">Ready</Badge>}
                  </div>
                  <ProgressBar value={p.steps.length ? done / p.steps.length : 0} label="Recovery progress" className="mt-4" />
                  <ul className="mt-4 space-y-1.5">
                    {p.steps.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1.5 hover:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={s.done}
                            onChange={() => void run((st, ctx) => toggleRecoveryStep(st, p.id, s.id, ctx))}
                            className="mt-0.5 h-4 w-4 accent-[var(--color-forest-500)]"
                          />
                          <span className={cn("text-sm", s.done && "text-muted line-through")}>{s.text}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void run((st, ctx) => setRecoveryStatus(st, p.id, "completed", ctx), { success: "Recovered. Nice work getting back on track." })}>
                      Mark recovered
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void run((st, ctx) => setRecoveryStatus(st, p.id, "abandoned", ctx), { success: "Plan closed. It stays in your history." })}>
                      Close plan
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={bulk}
        onClose={() => setBulk(false)}
        title="Let go of missed routine days"
        description={`${routineDays.length} routine days will be marked as let go with the same reason. Your routines continue as normal.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulk(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const ok = await run((s, ctx) => acknowledgeMany(s, routineDays.map((o) => o.id), bulkReason, ctx), { success: "Noted. Fresh start from here." });
                if (ok) setBulk(false);
              }}
            >
              Let them go
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">What got in the way?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {REASON_CODES.map((r) => (
              <label key={r} className={cn("flex cursor-pointer items-center rounded-xl border px-3.5 py-2.5 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", bulkReason === r ? "border-primary bg-primary text-primary-fg" : "border-line hover:bg-surface-2")}>
                <input type="radio" name="bulk-reason" className="sr-only" checked={bulkReason === r} onChange={() => setBulkReason(r)} />
                {REASON_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
      </Dialog>
    </div>
  );
}
