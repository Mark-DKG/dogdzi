import { REASON_LABELS, RESOLUTION_LABELS, STATUS_LABELS } from "@/lib/domain/copy";
import type { OccurrenceStatus, ReasonCode, Resolution } from "@/lib/domain/types";
import { Badge, Card } from "@/components/ui/surface";
import { formatDuration } from "@/lib/utils";

type Row = Record<string, unknown>;

export interface UserContent {
  actions: Row[];
  occurrences: Row[];
  history: Row[];
  responses: Row[];
  recoveryPlans: Row[];
  goals: Row[];
  milestones: Row[];
}

export interface UserUsage {
  sessions: Row[];
  events: Row[];
}

const fmt = (d: unknown) => (typeof d === "string" && d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "–");
const day = (d: unknown) => (typeof d === "string" && d ? new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const words = (v: unknown) => (typeof v === "string" ? v.replace(/_/g, " ") : "–");

/** Human summary of a history entry's extra data (notes, reasons, new dates). */
function eventDetail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const parts: string[] = [];
  if (str(d.reasonCode) && REASON_LABELS[d.reasonCode as ReasonCode]) parts.push(REASON_LABELS[d.reasonCode as ReasonCode]);
  if (str(d.outcome) && RESOLUTION_LABELS[d.outcome as Resolution]) parts.push(RESOLUTION_LABELS[d.outcome as Resolution]);
  if (str(d.from) && str(d.to)) parts.push(`${d.from} → ${d.to}`);
  else if (str(d.to)) parts.push(`now ${words(d.to)}`);
  if (str(d.date)) parts.push(`for ${d.date}`);
  if (Array.isArray(d.fields) && d.fields.length) parts.push(`changed ${d.fields.map(words).join(", ")}`);
  if (typeof d.steps === "number") parts.push(`${d.steps} steps`);
  if (str(d.note)) parts.push(`“${d.note}”`);
  if (str(d.title)) parts.push(`“${d.title}”`);
  if (str(d.by)) parts.push(`by ${d.by}`);
  return parts.length ? parts.join(" · ") : null;
}

function Table({ caption, head, rows, empty, min = 640 }: { caption: string; head: string[]; rows: React.ReactNode[][]; empty: string; min?: number }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: min }}>
        <caption className="px-4 py-3 text-left text-sm font-bold">
          {caption} <span className="font-normal text-muted">({rows.length})</span>
        </caption>
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-line">
              <td colSpan={head.length} className="px-4 py-3 text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, i) => (
              <tr key={i} className="border-t border-line align-top">
                {cells.map((c, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

export function UserContentView({ content }: { content: UserContent }) {
  const titles = new Map(content.actions.map((a) => [a.id as string, a.title as string]));
  const title = (id: unknown) => titles.get(id as string) ?? "(deleted action)";
  const timeline = [
    ...content.history.map((h) => ({ at: h.created_at as string, what: words(h.event_type), action: title(h.action_id), detail: eventDetail(h.data) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-4">
      <Table
        caption="Activity timeline"
        head={["When", "What happened", "Action", "Details"]}
        empty="No activity recorded yet."
        rows={timeline.map((t) => [<span key="w" className="whitespace-nowrap text-muted">{fmt(t.at)}</span>, <span key="e" className="font-medium capitalize">{t.what}</span>, t.action, <span key="d" className="text-muted">{t.detail ?? "–"}</span>])}
      />
      <Table
        caption="Reasons and notes"
        head={["When", "Action", "Why", "Note", "Decided"]}
        empty="No missed or skipped actions reviewed yet."
        rows={content.responses.map((r) => [
          <span key="w" className="whitespace-nowrap text-muted">{fmt(r.created_at)}</span>,
          <span key="a">
            {title(r.action_id)} <span className="text-muted">({words(r.trigger)})</span>
          </span>,
          REASON_LABELS[r.reason_code as ReasonCode] ?? words(r.reason_code),
          str(r.note) ?? <span className="text-muted">–</span>,
          RESOLUTION_LABELS[r.outcome as Resolution] ?? words(r.outcome),
        ])}
      />
      <Table
        caption="Actions"
        head={["Title", "Notes", "Type", "Starts", "Time", "Repeats", "Status"]}
        min={760}
        empty="No actions."
        rows={content.actions.map((a) => [
          <span key="t" className="font-medium">{a.title as string}</span>,
          <span key="n" className="text-muted">{str(a.notes) ?? "–"}</span>,
          words(a.kind),
          <span key="s" className="whitespace-nowrap">{day(a.start_date)}</span>,
          (a.due_time as string | null)?.slice(0, 5) ?? "–",
          a.recurrence ? "Yes" : "No",
          <Badge key="b" tone={a.status === "active" ? "done" : undefined}>{words(a.status)}</Badge>,
        ])}
      />
      <Table
        caption="Scheduled occurrences"
        head={["Date", "Time", "Action", "Status", "Outcome"]}
        empty="Nothing scheduled."
        rows={content.occurrences.map((o) => [
          <span key="d" className="whitespace-nowrap">{day(o.scheduled_date)}</span>,
          (o.scheduled_time as string | null)?.slice(0, 5) ?? "–",
          title(o.action_id),
          STATUS_LABELS[o.status as OccurrenceStatus] ?? words(o.status),
          o.resolution ? RESOLUTION_LABELS[o.resolution as Resolution] ?? words(o.resolution) : "–",
        ])}
      />
      <Table
        caption="Goals and milestones"
        head={["Goal", "Type", "Target", "Status", "Milestones"]}
        empty="No goals."
        rows={content.goals.map((g) => {
          const ms = content.milestones.filter((m) => m.goal_id === g.id);
          return [
            <span key="t" className="font-medium">{g.title as string}</span>,
            words(g.kind),
            day(g.target_date),
            words(g.status),
            ms.length ? (
              <ul key="m" className="space-y-0.5">
                {ms.map((m) => (
                  <li key={m.id as string}>
                    {m.status === "done" ? "✓" : "○"} {m.title as string}
                  </li>
                ))}
              </ul>
            ) : (
              "–"
            ),
          ];
        })}
      />
      <Table
        caption="Recovery plans"
        head={["Created", "Plan", "For", "Steps", "Restart", "Status"]}
        min={760}
        empty="No recovery plans."
        rows={content.recoveryPlans.map((p) => {
          const steps = Array.isArray(p.steps) ? (p.steps as { text?: string; done?: boolean }[]) : [];
          return [
            <span key="c" className="whitespace-nowrap text-muted">{fmt(p.created_at)}</span>,
            <span key="t" className="font-medium">{p.title as string}</span>,
            title(p.action_id),
            steps.length ? (
              <ul key="s" className="space-y-0.5">
                {steps.map((s, i) => (
                  <li key={i}>
                    {s.done ? "✓" : "○"} {s.text}
                  </li>
                ))}
              </ul>
            ) : (
              "–"
            ),
            day(p.restart_date),
            words(p.status),
          ];
        })}
      />
    </div>
  );
}

export function UserUsageView({ usage }: { usage: UserUsage }) {
  return (
    <div className="space-y-4">
      <Table
        caption="App sessions · last 30 days"
        head={["Started", "Last seen", "Time in app", "Device", "Opened as"]}
        empty="No sessions recorded."
        rows={usage.sessions.map((s) => [
          <span key="s" className="whitespace-nowrap">{fmt(s.started_at)}</span>,
          <span key="l" className="whitespace-nowrap text-muted">{fmt(s.last_seen_at)}</span>,
          formatDuration(Number(s.active_seconds ?? 0)),
          words(s.platform),
          s.display_mode === "standalone" ? "Installed app" : "Browser",
        ])}
      />
      <Table
        caption="Usage events · last 30 days"
        head={["When", "Event", "Device", "Details"]}
        empty="No events recorded."
        rows={usage.events.map((e) => {
          const props = e.props && typeof e.props === "object" ? Object.entries(e.props as Record<string, unknown>) : [];
          return [
            <span key="w" className="whitespace-nowrap text-muted">{fmt(e.created_at)}</span>,
            <span key="n" className="font-medium capitalize">{words(e.name)}</span>,
            words(e.platform),
            <span key="p" className="text-muted">{props.length ? props.map(([k, v]) => `${words(k)}: ${String(v)}`).join(" · ") : "–"}</span>,
          ];
        })}
      />
    </div>
  );
}
