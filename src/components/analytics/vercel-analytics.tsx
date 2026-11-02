"use client";

import { Analytics } from "@vercel/analytics/next";
import { analyticsAllowed } from "@/lib/analytics/client";
import { scrubUrl } from "@/lib/analytics/policy";

/**
 * Vercel Web Analytics (page views + selected custom events). Nothing is
 * sent without consent, admin pages are never reported, and URLs are
 * stripped of ids and query strings.
 */
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (!analyticsAllowed()) return null;
        if (new URL(event.url).pathname.startsWith("/admin")) return null;
        return { ...event, url: scrubUrl(event.url) };
      }}
    />
  );
}
