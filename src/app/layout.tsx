import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { VercelAnalytics } from "@/components/analytics/vercel-analytics";
import { PlatformBoot } from "@/components/app/platform-boot";
import { ServiceWorkerRegister } from "@/components/app/sw-register";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_URL } from "@/lib/supabase/config";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "DOGDZI · Get it done", template: "%s · DOGDZI" },
  description: "Plan your actions, follow through, account for what slipped, and recover. Personal execution and accountability by 9DEVs.",
  applicationName: "DOGDZI",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "DOGDZI", statusBarStyle: "black-translucent" },
  openGraph: { title: "DOGDZI · Get it done", description: "Personal execution and accountability.", images: ["/og.png"], type: "website" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#254032",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: shrink the layout when the keyboard opens so fixed bars and sheets stay above it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg">
          Skip to content
        </a>
        <ToastProvider>
          {children}
        </ToastProvider>
        <VercelAnalytics />
        <ServiceWorkerRegister />
        <PlatformBoot />
      </body>
    </html>
  );
}
