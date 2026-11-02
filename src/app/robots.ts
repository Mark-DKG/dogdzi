import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy"], disallow: ["/app", "/admin", "/api", "/auth", "/onboarding"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
