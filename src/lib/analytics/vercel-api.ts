import "server-only";

/**
 * Optional: aggregate page views from the Vercel Web Analytics REST API for
 * the admin dashboard. Needs VERCEL_API_TOKEN + VERCEL_PROJECT_ID. Counts are
 * production-only and aggregate; they are not used for per-user time spent.
 */
export const vercelAnalyticsConfigured = Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);

export async function vercelPageViews(since: Date, until: Date): Promise<number | null> {
  if (!vercelAnalyticsConfigured) return null;
  const params = new URLSearchParams({
    projectId: process.env.VERCEL_PROJECT_ID!,
    since: since.toISOString(),
    until: until.toISOString(),
  });
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
  try {
    const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { total?: number; count?: number } | number; total?: number; count?: number };
    const d = body.data;
    if (typeof d === "number") return d;
    return d?.total ?? d?.count ?? body.total ?? body.count ?? null;
  } catch {
    return null;
  }
}
