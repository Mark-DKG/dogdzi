import type { ReactNode } from "react";
import { rate, type AdminAnalytics } from "@/lib/admin/analytics";
import { Card, SectionTitle, Stat } from "@/components/ui/surface";
import { formatDuration, percent } from "@/lib/utils";

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: ReactNode[][]; empty: string }) {
  return (
    <Card className="overflow-hidden">
      <h3 className="border-b border-line px-4 py-3 text-sm font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                {head.map((h, i) => (
                  <th key={h} scope="col" className={i ? "px-4 py-2 text-right" : "px-4 py-2"}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className={j ? "px-4 py-2.5 text-right tabular-nums" : "px-4 py-2.5 font-medium"}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Aggregate analytics. Presentational only; data comes from public.admin_analytics. */
export function AnalyticsView({ data, pageViews }: { data: AdminAnalytics; pageViews?: number | null }) {
  const max = Math.max(1, ...data.daily.map((d) => d.active));
  const r = data.actions.registered;
  const g = data.actions.guest;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total accounts" value={data.accounts.total} hint={`${data.accounts.new} new in range`} />
        <Stat label="Active users" value={data.users.active_registered + data.users.active_guests} hint={`${data.users.active_registered} registered · ${data.users.active_guests} guests`} />
        <Stat label="Returning users" value={data.users.returning_registered} hint="registered, active on 2+ days" />
        <Stat label="Guest → account" value={data.accounts.from_guest} hint={`${data.conversions} conversion events`} />
        <Stat label="DAU / WAU / MAU" value={`${data.users.dau} / ${data.users.wau} / ${data.users.mau}`} hint="as of range end" />
        <Stat label="Sessions" value={data.sessions.count} hint={`avg ${formatDuration(data.sessions.avg_session_seconds)} (est.)`} />
        <Stat label="Time in app (est.)" value={formatDuration(data.sessions.total_seconds)} hint={`avg ${formatDuration(data.sessions.avg_seconds_per_user)} per user`} />
        <Stat label="Page views" value={pageViews ?? "–"} hint={pageViews == null ? "Vercel API not configured" : "Vercel Web Analytics"} />
      </div>

      <SectionTitle>Daily active users</SectionTitle>
      <Card className="p-5">
        {data.daily.length === 0 ? (
          <p className="text-sm text-muted">No sessions recorded in this range.</p>
        ) : (
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily active users chart">
            {data.daily.map((d) => (
              <div key={d.date} className="flex h-full flex-1 flex-col justify-end" title={`${d.date}: ${d.active} active, ${d.sessions} sessions, ${formatDuration(d.seconds)}`}>
                <div className="min-h-[2px] rounded-t-sm bg-forest-400" style={{ height: `${(d.active / max) * 100}%` }} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 pt-6 lg:grid-cols-2">
        <Table
          title="Guest vs registered"
          head={["Segment", "Users", "Sessions", "Time (est.)"]}
          empty="No sessions in this range."
          rows={data.segments.map((s) => [s.segment === "guest" ? "Guests" : "Registered", s.users, s.sessions, formatDuration(s.seconds)])}
        />
        <Table
          title="Platform"
          head={["Platform", "Users", "Sessions", "Time (est.)"]}
          empty="No sessions in this range."
          rows={data.platforms.map((p) => [`${p.platform}${p.display_mode === "standalone" ? " · installed" : ""}`, p.users, p.sessions, formatDuration(p.seconds)])}
        />
        <Table
          title="Actions"
          head={["Metric", "Registered", "Guests*"]}
          empty=""
          rows={[
            ["Created", r.created, g.created],
            ["Completed", r.completed, g.completed],
            ["Missed", r.missed, g.missed],
            ["Skipped", r.skipped, g.skipped],
            ["Recovery plans started", r.recovery_created, g.recovery_created],
            ["Recovery plans completed", r.recovery_completed, "–"],
          ]}
        />
        <Table
          title={`Retention · cohort of ${data.retention.cohort} new accounts`}
          head={["Returned on/after", "Eligible", "Returned", "Rate"]}
          empty=""
          rows={(["d1", "d7", "d30"] as const).map((k) => [`Day ${k.slice(1)}`, data.retention[k].eligible, data.retention[k].returned, percent(rate(data.retention[k]))])}
        />
      </div>
      <p className="pt-4 text-xs text-muted">
        Time spent is estimated from first-party heartbeats (1-minute intervals, sessions end after 5 idle minutes) and covers every visitor. *Guest figures come from usage
        events, because guest content never leaves the device. Registered action counts come from the database and aren&apos;t filtered by platform.
      </p>
    </div>
  );
}
