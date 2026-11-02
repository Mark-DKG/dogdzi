"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { REASON_LABELS, RESOLUTION_LABELS } from "@/lib/domain/copy";
import { formatDateLabel, toISODate } from "@/lib/domain/dates";
import type { HistoryEvent, ReasonCode, Snapshot } from "@/lib/domain/types";
import { useData } from "@/components/app/data-provider";
import { DataGate } from "@/components/app/gate";
import { IconCheck, IconEdit, IconHistory, IconLifebuoy, IconMove, IconPlus, IconReview, IconShield, IconSkip, IconSpark, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { HistorySkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, Notice } from "@/components/ui/states";
import { PageHeader, SectionTitle } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  return <DataGate skeleton={<HistorySkeleton />}>{() => <History />}</DataGate>;
}

const META: Record<HistoryEvent["type"], { label: string; icon: React.ReactNode; tone: string }> = {
  created: { label: "Planned", icon: <IconPlus size={16} />, tone: "bg-surface-2 text-forest-500" },
  edited: { label: "Edited", icon: <IconEdit size={16} />, tone: "bg-surface-2 text-muted" },
  completed: { label: "Done", icon: <IconCheck size={16} />, tone: "bg-done-bg text-done" },
  completed_late: { label: "Done later", icon: <IconCheck size={16} />, tone: "bg-done-bg text-done" },
  reopened: { label: "Reopened", icon: <IconReview size={16} />, tone: "bg-surface-2 text-muted" },
  missed: { label: "Missed", icon: <IconReview size={16} />, tone: "bg-missed-bg text-missed" },
  skipped: { label: "Skipped", icon: <IconSkip size={16} />, tone: "bg-missed-bg text-missed" },
  rescheduled: { label: "Rescheduled", icon: <IconMove size={16} />, tone: "bg-warn-bg text-warn" },
  cancelled: { label: "Cancelled", icon: <IconX size={16} />, tone: "bg-surface-2 text-muted" },
  acknowledged: { label: "Let go", icon: <IconSpark size={16} />, tone: "bg-surface-2 text-muted" },
  reason_recorded: { label: "Reason noted", icon: <IconReview size={16} />, tone: "bg-surface-2 text-forest-500" },
  recovery_plan_created: { label: "Recovery plan", icon: <IconLifebuoy size={16} />, tone: "bg-surface-2 text-forest-500" },
  recovery_plan_completed: { label: "Recovered", icon: <IconLifebuoy size={16} />, tone: "bg-done-bg text-done" },
  admin_annotation: { label: "Support note", icon: <IconShield size={16} />, tone: "bg-surface-2 text-muted" },
};

function detail(e: HistoryEvent, s: Snapshot, today: string): string | null {
  switch (e.type) {
    case "rescheduled":
      return typeof e.data.to === "string" ? `to ${formatDateLabel(e.data.to, today)}` : null;
    case "reason_recorded": {
      const r = s.responses.find((x) => x.id === e.data.responseId);
      const code = (r?.reasonCode ?? e.data.reasonCode) as ReasonCode | undefined;
      const parts = [code ? REASON_LABELS[code] : null, r ? RESOLUTION_LABELS[r.outcome] : null].filter(Boolean);
      return parts.join(" → ") + (r?.note ? ` · “${r.note}”` : "");
    }
    case "edited":
      return Array.isArray(e.data.fields) ? `changed ${(e.data.fields as string[]).join(", ")}` : null;
    case "cancelled":
      return e.data.scope === "occurrence" ? "this day only" : null;
    case "admin_annotation":
      return typeof e.data.note === "string" ? e.data.note : null;
    default:
      return typeof e.data.date === "string" && e.data.date !== e.at.slice(0, 10) ? `for ${formatDateLabel(e.data.date, today)}` : null;
  }
}

function History() {
  const { snapshot, today, listHistory, mode, accountsAvailable } = useData();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [limited, setLimited] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "outcomes">("outcomes");

  const load = useCallback(
    async (before?: string) => {
      try {
        const page = await listHistory({ before, limit: 60 });
        setEvents((prev) => (before ? [...prev, ...page.events] : page.events));
        setHasMore(page.hasMore);
        setLimited(page.limited);
        setState("ready");
      } catch {
        if (!before) setState("error");
      }
    },
    [listHistory],
  );

  useEffect(() => {
    void load();
    // Refresh when local history changes (new events appended).
  }, [load, snapshot.events.length]);

  if (state === "loading") return <HistorySkeleton />;
  if (state === "error") return <ErrorState message="We couldn't load your history." onRetry={() => void load()} />;

  const titles = new Map(snapshot.actions.map((a) => [a.id, a.title]));
  const shown = filter === "all" ? events : events.filter((e) => e.type !== "created" && e.type !== "edited");
  const groups = new Map<string, HistoryEvent[]>();
  for (const e of shown) {
    const d = toISODate(new Date(e.at), snapshot.preferences.timezone);
    groups.set(d, [...(groups.get(d) ?? []), e]);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="History" subtitle="An honest record: what you did, what slipped, and how you responded. Nothing is removed." />
      <div className="mb-4 flex gap-2" role="group" aria-label="Filter history">
        {(["outcomes", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", filter === f ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface")}
          >
            {f === "outcomes" ? "Outcomes" : "Everything"}
          </button>
        ))}
      </div>

      {mode === "guest" && limited && (
        <Notice className="mb-4" action={accountsAvailable ? <Link href="/signup" className="text-sm font-bold underline">Create account</Link> : undefined}>
          Guests see the last 7 days. Older history is still kept on this device and moves into your account when you sign up.
        </Notice>
      )}

      {groups.size === 0 ? (
        <EmptyState icon={<IconHistory />} title="No history yet" body="As you complete, skip or review actions, your record builds up here." />
      ) : (
        Array.from(groups, ([date, list]) => (
          <section key={date}>
            <SectionTitle>{formatDateLabel(date, today)}</SectionTitle>
            <ol className="space-y-1">
              {list.map((e) => {
                const m = META[e.type];
                const d = detail(e, snapshot, today);
                return (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl px-1 py-2">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.tone)}>{m.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{m.label}</span>
                        <span className="text-muted"> · </span>
                        <span>{titles.get(e.actionId) ?? "An action"}</span>
                      </p>
                      {d && <p className="text-xs text-muted">{d}</p>}
                    </div>
                    <time className="shrink-0 pt-0.5 text-xs tabular-nums text-muted" dateTime={e.at}>
                      {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                );
              })}
            </ol>
          </section>
        ))
      )}
      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="secondary"
            loading={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(events[events.length - 1]?.at);
              setLoadingMore(false);
            }}
          >
            Load older
          </Button>
        </div>
      )}
    </div>
  );
}
