import Link from "next/link";
import { AnalyticsView } from "@/components/admin/analytics-view";
import { Notice } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/surface";
import { emptyAnalytics, type AdminAnalytics } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/admin/guard";
import { vercelPageViews } from "@/lib/analytics/vercel-api";
import { getServiceSupabase } from "@/lib/supabase/server";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const forbidden = sp.error === "forbidden";

  if (!admin.perms.has("analytics:read")) {
    return (
      <>
        <PageHeader title="Admin console" subtitle="Your role has no dashboard access." />
        {forbidden && <Notice tone="warn">You don&apos;t have permission for that page.</Notice>}
      </>
    );
  }

  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const sb = getServiceSupabase()!;
  const [{ data, error }, pageViews] = await Promise.all([
    sb.rpc("admin_analytics", { p_from: from.toISOString(), p_to: to.toISOString(), p_platform: null }),
    vercelPageViews(from, to),
  ]);
  if (error) throw new Error("analytics unavailable");

  return (
    <>
      <PageHeader title="Overview" subtitle="Last 7 days, aggregate only." actions={<Link href="/admin/analytics" className="text-sm font-semibold underline">Full analytics</Link>} />
      {forbidden && <Notice tone="warn" className="mb-4">You don&apos;t have permission for that page.</Notice>}
      <AnalyticsView data={(data as AdminAnalytics) ?? emptyAnalytics(from, to)} pageViews={pageViews} />
    </>
  );
}
