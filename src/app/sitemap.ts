import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms", "/signin", "/signup"].map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "monthly" as const }));
}
