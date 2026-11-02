import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { DataProvider } from "@/components/app/data-provider";

export const metadata: Metadata = { title: "Today", robots: { index: false } };

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AppShell>{children}</AppShell>
    </DataProvider>
  );
}
