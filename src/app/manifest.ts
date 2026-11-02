import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DOGDZI — Get it done",
    short_name: "DOGDZI",
    description: "Personal execution and accountability. Plan, follow through, review and recover.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    lang: "en",
    dir: "ltr",
    background_color: "#254032",
    theme_color: "#254032",
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/app", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Review", url: "/app/review", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
