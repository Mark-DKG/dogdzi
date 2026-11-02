import type { Metadata } from "next";
import { DataProvider } from "@/components/app/data-provider";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}
