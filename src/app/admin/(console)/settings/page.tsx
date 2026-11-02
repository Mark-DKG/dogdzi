import type { Metadata } from "next";
import { saveAnnouncement } from "@/app/admin/actions";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/surface";
import { ADMIN_REQUIRE_MFA, requireAdmin } from "@/lib/admin/guard";
import { vercelAnalyticsConfigured } from "@/lib/analytics/vercel-api";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin("settings:manage");
  const { data } = await getServiceSupabase()!.from("system_settings").select("value, updated_at").eq("key", "announcement").maybeSingle();
  const ann = (data?.value ?? { text: "", active: false }) as { text: string; active: boolean };

  const checks: [string, boolean, string][] = [
    ["Admin MFA required", ADMIN_REQUIRE_MFA, "Set ADMIN_REQUIRE_MFA=true"],
    ["Web Push (VAPID keys)", Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), "Generate with npm run vapid:generate"],
    ["Reminder cron secret", Boolean(process.env.CRON_SECRET), "Set CRON_SECRET and schedule /api/cron/reminders"],
    ["Vercel Analytics API (admin page views)", vercelAnalyticsConfigured, "Optional: VERCEL_API_TOKEN + VERCEL_PROJECT_ID"],
    ["Usage analytics", true, "Always on for every visitor"],
  ];

  return (
    <>
      <PageHeader title="System settings" />
      <Card className="p-5">
        <AdminForm action={saveAnnouncement}>
          <label htmlFor="text" className="block text-sm font-semibold">
            In-app announcement
          </label>
          <p className="text-xs text-muted">Shown at the top of the app for everyone. Use it for planned maintenance or important notices.</p>
          <textarea id="text" name="text" maxLength={280} defaultValue={ann.text} className="min-h-20 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={ann.active} className="h-4 w-4" /> Show announcement
          </label>
          <SubmitButton>Save</SubmitButton>
        </AdminForm>
      </Card>

      <SectionTitle>Configuration status</SectionTitle>
      <Card>
        <ul>
          {checks.map(([label, ok, hint]) => (
            <li key={label} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 first:border-0">
              <span className="text-sm font-medium">{label}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {!ok && hint}
                <Badge tone={ok ? "done" : "warn"}>{ok ? "OK" : "Not set"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
