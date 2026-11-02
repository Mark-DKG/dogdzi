"use client";

import { Analytics } from "@vercel/analytics/next";
import { scrubUrl } from "@/lib/analytics/policy";

/**
 * Vercel Web Analytics (page views + selected custom events). Admin pages
 * are never reported, and URLs are stripped of ids and query strings.
 */
export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (new URL(event.url).pathname.startsWith("/admin")) return null;
        return { ...event, url: scrubUrl(event.url) };
      }}
    />
  );
}
