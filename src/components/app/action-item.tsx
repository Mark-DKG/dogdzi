"use client";

import { cancelAction, completeOccurrence, reopenOccurrence } from "@/lib/domain/actions";
import { RESOLUTION_LABELS, STATUS_LABELS } from "@/lib/domain/copy";
import { formatDateLabel, formatTime } from "@/lib/domain/dates";
import type { Occurrence } from "@/lib/domain/types";
import { IconCheck, IconEdit, IconMove, IconRepeat, IconSkip, IconTrash, IconTarget } from "@/components/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { Badge } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { useComposer } from "./composer";
import { useData } from "./data-provider";

export function ActionItem({ occurrence, showDate = false }: { occurrence: Occurrence; showDate?: boolean }) {
  const { snapshot, today, run } = useData();
  const composer = useComposer();
  const [confirming, setConfirming] = useState(false);
  const action = snapshot.actions.find((a) => a.id === occurrence.actionId);
  if (!action) return null;
  const category = snapshot.categories.find((c) => c.id === action.categoryId);
  const goal = snapshot.goals.find((g) => g.id === action.goalId);
  const o = occurrence;
  const done = o.status === "done";
  const open = o.status === "pending";
  const needsReview = o.status === "missed" && o.resolution === null;

  const toggle = () => {
    if (open || needsReview) {
      void run((s, ctx) => completeOccurrence(s, o.id, ctx), { success: needsReview ? "Done. Recorded as completed later." : undefined });
    } else if (done) {
      void run((s, ctx) => reopenOccurrence(s, o.id, ctx));
    }
  };

  const confirmCancel = () => setConfirming(true);

  const meta: string[] = [];
  if (showDate) meta.push(formatDateLabel(o.date, today));
  meta.push(formatTime(o.time));
  if (action.durationMin) meta.push(`${action.durationMin} min`);

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-2xl border bg-surface p-3 pr-1.5 transition-colors",
        needsReview ? "border-missed/40" : "border-line",
        (done || o.status === "cancelled" || o.status === "rescheduled") && "opacity-75",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!(open || done || needsReview)}
        aria-label={done ? `Mark "${action.title}" as not done` : `Mark "${action.title}" as done`}
        aria-pressed={done}
        className={cn("group/check -m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full", !(open || done || needsReview) && "cursor-default")}
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
            done ? "border-done bg-done text-cream-50 dark:text-forest-950" : "border-forest-300 text-transparent group-hover/check:border-forest-500 group-hover/check:text-forest-400",
          )}
        >
          <IconCheck size={16} strokeWidth={2.6} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-semibold text-fg", done && "line-through decoration-forest-300")}>{action.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{meta.join(" · ")}</span>
          {action.recurrence && (
            <span className="inline-flex items-center gap-1" title="Routine">
              <IconRepeat size={12} />
              <span className="sr-only">Routine</span>
            </span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: category.color }} aria-hidden />
              {category.name}
            </span>
          )}
          {goal && (
            <span className="inline-flex items-center gap-1">
              <IconTarget size={12} />
              {goal.title}
            </span>
          )}
          {action.priority === "high" && <Badge tone="warn">High</Badge>}
          {!open && !needsReview && !done && <Badge tone={o.status === "missed" || o.status === "skipped" ? "missed" : "neutral"}>{STATUS_LABELS[o.status]}{o.resolution ? ` · ${RESOLUTION_LABELS[o.resolution]}` : ""}</Badge>}
          {done && o.resolution === "completed_late" && <Badge tone="done">Done later</Badge>}
        </div>
      </div>

      {needsReview ? (
        <Button size="sm" variant="secondary" className="border-missed/40 text-missed" onClick={() => composer.review(o, "missed")}>
          Review
        </Button>
      ) : null}

      {(open || needsReview) && (
        <Menu
          label={`Options for ${action.title}`}
          items={[
            { label: "Edit", icon: <IconEdit size={16} />, onSelect: () => composer.editAction(action.id) },
            ...(open
              ? [
                  { label: "Reschedule", icon: <IconMove size={16} />, onSelect: () => composer.reschedule(o) },
                  { label: "Skip", icon: <IconSkip size={16} />, onSelect: () => composer.review(o, "skipped") },
                ]
              : []),
            { label: action.recurrence ? "Stop routine" : "Cancel action", icon: <IconTrash size={16} />, tone: "danger" as const, onSelect: confirmCancel },
          ]}
        />
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={action.recurrence ? "Stop this routine?" : "Cancel this action?"}
        body={
          action.recurrence
            ? "Future days are cancelled. Everything that already happened stays in your history."
            : "It moves out of your plan but stays in your history."
        }
        confirmLabel={action.recurrence ? "Stop routine" : "Cancel action"}
        tone="danger"
        onConfirm={() => void run((s, ctx) => cancelAction(s, action.id, ctx), { success: "Cancelled. It's still in your history." })}
      />
    </li>
  );
}

export function ActionList({ items, showDate }: { items: Occurrence[]; showDate?: boolean }) {
  return (
    <ul className="space-y-2.5">
      {items.map((o) => (
        <ActionItem key={o.id} occurrence={o} showDate={showDate} />
      ))}
    </ul>
  );
}

export function sortByTime(a: Occurrence, b: Occurrence) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.createdAt.localeCompare(b.createdAt);
}
