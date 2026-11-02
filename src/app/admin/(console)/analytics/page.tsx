import Link from "next/link";
import type { Metadata } from "next";
import { AnalyticsView } from "@/components/admin/analytics-view";
import { PageHeader } from "@/components/ui/surface";
import { PLATFORMS, parseRange, RANGES, type AdminAnalytics } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/admin/guard";
import { vercelPageViews } from "@/lib/analytics/vercel-api";
import { getServiceSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("analytics:read");
  const sp = await searchParams;
  const r = parseRange(sp, new Date());
  const sb = getServiceSupabase()!;
  const [{ data, error }, pageViews] = await Promise.all([
    sb.rpc("admin_analytics", { p_from: r.from.toISOString(), p_to: r.to.toISOString(), p_platform: r.platform }),
    vercelPageViews(r.from, r.to),
  ]);
  if (error) throw new Error("analytics unavailable");

  const link = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const merged = { range: r.key === "custom" ? null : r.key, platform: r.platform, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    return `/admin/analytics?${q}`;
  };
  const chip = (active: boolean) => cn("rounded-full border px-3 py-1.5 text-xs font-semibold", active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface hover:bg-surface-2");

  return (
    <>
      <PageHeader title="Analytics" subtitle={`${r.from.toISOString().slice(0, 10)} → ${r.to.toISOString().slice(0, 10)} (UTC) · aggregate only`} />
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Range</span>
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
            <Link key={k} href={link({ range: k, from: null, to: null })} className={chip(r.key === k)}>
              {k}
            </Link>
          ))}
          <form action="/admin/analytics" className="flex items-center gap-2">
            {r.platform && <input type="hidden" name="platform" value={r.platform} />}
            <label className="sr-only" htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={r.key === "custom" ? r.from.toISOString().slice(0, 10) : ""} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" />
            <label className="sr-only" htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={r.key === "custom" ? r.to.toISOString().slice(0, 10) : ""} className="h-8 rounded-lg border border-line bg-surface px-2 text-xs" />
            <button type="submit" className={chip(r.key === "custom")}>Apply</button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Platform</span>
          <Link href={link({ platform: null })} className={chip(!r.platform)}>
            All
          </Link>
          {PLATFORMS.map((p) => (
            <Link key={p} href={link({ platform: p })} className={chip(r.platform === p)}>
              {p}
            </Link>
          ))}
        </div>
      </div>
      <AnalyticsView data={data as AdminAnalytics} pageViews={pageViews} />
    </>
  );
}
