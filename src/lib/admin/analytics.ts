/** Types and helpers for the admin analytics dashboard (shape of public.admin_analytics). */

export interface AdminAnalytics {
  range: { from: string; to: string; platform: string | null };
  accounts: { total: number; new: number; from_guest: number };
  users: { active_registered: number; active_guests: number; returning_registered: number; dau: number; wau: number; mau: number };
  sessions: { count: number; total_seconds: number; avg_session_seconds: number; avg_seconds_per_user: number };
  segments: { segment: "guest" | "registered"; sessions: number; users: number; seconds: number }[];
  platforms: { platform: string; display_mode: string; sessions: number; users: number; seconds: number }[];
  daily: { date: string; active: number; sessions: number; seconds: number }[];
  actions: {
    registered: { created: number; completed: number; missed: number; skipped: number; recovery_created: number; recovery_completed: number };
    guest: { created: number; completed: number; missed: number; skipped: number; recovery_created: number };
  };
  conversions: number;
  retention: { cohort: number; d1: RetentionCell; d7: RetentionCell; d30: RetentionCell };
}
export interface RetentionCell {
  eligible: number;
  returned: number;
}

export const RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export const PLATFORMS = ["android", "ios", "desktop", "other"] as const;

export interface ParsedRange {
  from: Date;
  to: Date;
  key: keyof typeof RANGES | "custom";
  platform: (typeof PLATFORMS)[number] | null;
}

/** Parse ?range=7d|30d|90d or ?from=YYYY-MM-DD&to=YYYY-MM-DD (UTC, max 366 days) and ?platform=. */
export function parseRange(params: Record<string, string | string[] | undefined>, now: Date): ParsedRange {
  const get = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : (params[k] as string | undefined));
  const p = get("platform");
  const platform = (PLATFORMS as readonly string[]).includes(p ?? "") ? (p as ParsedRange["platform"]) : null;
  const from = get("from");
  const to = get("to");
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && re.test(from) && re.test(to)) {
    const f = new Date(`${from}T00:00:00Z`);
    const t = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86400000);
    if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime()) && f < t && t.getTime() - f.getTime() <= 366 * 86400000) {
      return { from: f, to: t > now ? now : t, key: "custom", platform };
    }
  }
  const key = (Object.keys(RANGES) as (keyof typeof RANGES)[]).find((k) => k === get("range")) ?? "7d";
  return { from: new Date(now.getTime() - RANGES[key] * 86400000), to: now, key, platform };
}

export function rate(c: RetentionCell): number | null {
  return c.eligible ? c.returned / c.eligible : null;
}

export function emptyAnalytics(from: Date, to: Date): AdminAnalytics {
  const cell = { eligible: 0, returned: 0 };
  return {
    range: { from: from.toISOString(), to: to.toISOString(), platform: null },
    accounts: { total: 0, new: 0, from_guest: 0 },
    users: { active_registered: 0, active_guests: 0, returning_registered: 0, dau: 0, wau: 0, mau: 0 },
    sessions: { count: 0, total_seconds: 0, avg_session_seconds: 0, avg_seconds_per_user: 0 },
    segments: [],
    platforms: [],
    daily: [],
    actions: {
      registered: { created: 0, completed: 0, missed: 0, skipped: 0, recovery_created: 0, recovery_completed: 0 },
      guest: { created: 0, completed: 0, missed: 0, skipped: 0, recovery_created: 0 },
    },
    conversions: 0,
    retention: { cohort: 0, d1: cell, d7: cell, d30: cell },
  };
}
