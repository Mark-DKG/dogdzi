import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addAnnotation, deleteUserAccount, requestContentAccess, sendPasswordReset, setSuspended } from "@/app/admin/actions";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { UserContentView, UserUsageView, type UserContent, type UserUsage } from "@/components/admin/user-activity";
import { IconAlert, IconChevronLeft, IconLock } from "@/components/icons";
import { Badge, Card, SectionTitle, Stat } from "@/components/ui/surface";
import { audit, requireAdmin } from "@/lib/admin/guard";
import { isUuid } from "@/lib/domain/ids";
import { getServiceSupabase } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };
const CONTENT_GRANT_MINUTES = 15;
const ROWS = 200;

interface Overview {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
  profile: { signup_source: string; converted_from_guest_at: string | null; last_active_at: string | null } | null;
  counts: Record<string, number>;
}

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "–");

export default async function UserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin("accounts:read");
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const sb = getServiceSupabase()!;
  const { data } = await sb.rpc("admin_user_overview", { p_user: id });
  if (!data) notFound();
  const u = data as Overview;
  await audit(admin, { action: "account.view", targetType: "user", targetId: id });
  const banned = !!u.banned_until && new Date(u.banned_until) > new Date();

  // Identifiable activity: analytics:user_level only, and logged.
  let activity: { sessions: number; seconds: number; days_active: number; platforms: string[] } | null = null;
  let usage: UserUsage | null = null;
  if (admin.perms.has("analytics:user_level")) {
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const [res, sessions, events] = await Promise.all([
      sb.rpc("admin_user_activity", { p_user: id, p_days: 30 }),
      sb.from("app_sessions").select("started_at, last_seen_at, active_seconds, platform, display_mode").eq("user_id", id).gte("started_at", since30).order("started_at", { ascending: false }).limit(ROWS),
      sb.from("analytics_events").select("name, platform, props, created_at").eq("user_id", id).gte("created_at", since30).order("created_at", { ascending: false }).limit(ROWS),
    ]);
    activity = res.data;
    usage = { sessions: sessions.data ?? [], events: events.data ?? [] };
    await audit(admin, { action: "analytics.user_level_view", targetType: "user", targetId: id });
  }

  // Content: only with content:read AND a fresh, reasoned audit entry for this admin + user.
  let content: UserContent | null = null;
  if (admin.perms.has("content:read") && sp.content && isUuid(sp.content)) {
    const since = new Date(Date.now() - CONTENT_GRANT_MINUTES * 60000).toISOString();
    const { data: grant } = await sb
      .from("audit_log")
      .select("id")
      .eq("actor_id", admin.userId)
      .eq("action", "content.view")
      .eq("target_id", id)
      .eq("metadata->>grant", sp.content)
      .gte("created_at", since)
      .maybeSingle();
    if (grant) {
      const [a, o, h, r, p, g, m] = await Promise.all([
        sb.from("actions").select("id, title, notes, status, kind, start_date, due_time, recurrence, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(ROWS),
        sb.from("occurrences").select("id, action_id, scheduled_date, scheduled_time, status, resolution").eq("user_id", id).order("scheduled_date", { ascending: false }).limit(ROWS),
        sb.from("action_history").select("id, action_id, event_type, data, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(ROWS),
        sb.from("accountability_responses").select("id, action_id, trigger, reason_code, note, outcome, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(ROWS),
        sb.from("recovery_plans").select("id, action_id, title, steps, restart_date, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(ROWS),
        sb.from("goals").select("id, title, kind, target_date, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(ROWS),
        sb.from("milestones").select("id, goal_id, title, status, position").eq("user_id", id).order("position", { ascending: true }).limit(ROWS * 2),
      ]);
      content = { actions: a.data ?? [], occurrences: o.data ?? [], history: h.data ?? [], responses: r.data ?? [], recoveryPlans: p.data ?? [], goals: g.data ?? [], milestones: m.data ?? [] };
    }
  }

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <IconChevronLeft size={16} /> Accounts
      </Link>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{u.email}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {banned ? <Badge tone="missed">Suspended</Badge> : <Badge tone="done">Active</Badge>}
          {u.is_admin && <Badge tone="brand">Admin</Badge>}
          {!u.email_confirmed_at && <Badge tone="warn">Email unconfirmed</Badge>}
          {u.profile?.signup_source === "guest_conversion" && <Badge>Converted from guest</Badge>}
        </div>
        <p className="mt-2 text-xs text-muted">
          Joined {fmt(u.created_at)} · last sign-in {fmt(u.last_sign_in_at)} · last active {fmt(u.profile?.last_active_at)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Actions" value={u.counts.actions} hint={`${u.counts.active_actions} active`} />
        <Stat label="Completed" value={u.counts.done} />
        <Stat label="Missed / skipped" value={`${u.counts.missed} / ${u.counts.skipped}`} hint={`${u.counts.needs_review} awaiting review`} />
        <Stat label="Recovery plans" value={u.counts.recovery_plans} hint={`${u.counts.push_subscriptions} push devices`} />
      </div>

      {activity && (
        <>
          <SectionTitle>Activity · last 30 days (identifiable, logged)</SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sessions" value={activity.sessions} />
            <Stat label="Time (est.)" value={formatDuration(activity.seconds)} />
            <Stat label="Days active" value={activity.days_active} />
            <Stat label="Platforms" value={activity.platforms.join(", ") || "–"} />
          </div>
          {usage && (
            <div className="mt-4">
              <UserUsageView usage={usage} />
            </div>
          )}
        </>
      )}

      {admin.perms.has("accounts:write") && (
        <>
          <SectionTitle>Account actions</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <AdminForm action={setSuspended}>
                <input type="hidden" name="userId" value={id} />
                <input type="hidden" name="suspend" value={banned ? "false" : "true"} />
                <label htmlFor="reason" className="block text-sm font-semibold">
                  {banned ? "Restore access" : "Suspend sign-in"}
                </label>
                <input id="reason" name="reason" required minLength={5} maxLength={500} placeholder="Reason (recorded in the audit log)" className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm" />
                <SubmitButton variant={banned ? "primary" : "danger"}>{banned ? "Restore account" : "Suspend account"}</SubmitButton>
              </AdminForm>
            </Card>
            <Card className="p-5">
              <AdminForm action={sendPasswordReset}>
                <input type="hidden" name="userId" value={id} />
                <p className="text-sm font-semibold">Password reset</p>
                <p className="text-xs text-muted">Emails the user a reset link. Staff never see or set passwords.</p>
                <SubmitButton variant="secondary">Send reset link</SubmitButton>
              </AdminForm>
            </Card>
          </div>
        </>
      )}

      {admin.perms.has("content:read") && (
        <>
          <SectionTitle>What they&apos;ve recorded</SectionTitle>
          {!content ? (
            <Card className="p-5">
              <form action={requestContentAccess} className="space-y-3">
                <input type="hidden" name="userId" value={id} />
                <div className="flex items-start gap-3">
                  <IconLock className="mt-0.5 text-muted" />
                  <p className="text-sm text-muted">
                    See everything this person has recorded: actions, notes, history, the reasons they gave, goals and recovery plans. Give a reason first. It&apos;s recorded in the audit log, and access lasts {CONTENT_GRANT_MINUTES} minutes.
                  </p>
                </div>
                <label htmlFor="content-reason" className="block text-sm font-semibold">
                  Reason (e.g. ticket number and request)
                </label>
                <input id="content-reason" name="reason" required minLength={10} maxLength={500} className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm" />
                {sp.content_error && <p className="text-sm font-medium text-missed">Enter a reason of at least 10 characters.</p>}
                <SubmitButton variant="secondary">View activity</SubmitButton>
              </form>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-warn">
                Read-only view, open for {CONTENT_GRANT_MINUTES} minutes. Access is logged. History can&apos;t be edited. Showing the latest {ROWS} of each.
              </p>
              <UserContentView content={content} />
              {admin.perms.has("content:write") && content.actions.length > 0 && (
                <Card className="p-5">
                  <AdminForm action={addAnnotation}>
                    <input type="hidden" name="userId" value={id} />
                    <p className="text-sm font-semibold">Append a support note to an action&apos;s history</p>
                    <p className="text-xs text-muted">Notes are added as new entries the user can see. Nothing existing is changed.</p>
                    <label htmlFor="actionId" className="sr-only">Action</label>
                    <select id="actionId" name="actionId" className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm">
                      {content.actions.map((a) => (
                        <option key={a.id as string} value={a.id as string}>
                          {a.title as string}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="note" className="sr-only">Note</label>
                    <textarea id="note" name="note" required minLength={3} maxLength={500} className="min-h-20 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm" placeholder="e.g. Restored after sync issue, ticket #123" />
                    <SubmitButton variant="secondary">Append note</SubmitButton>
                  </AdminForm>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {admin.perms.has("accounts:delete") && (
        <>
          <SectionTitle>Danger zone</SectionTitle>
          <Card className="border-missed/40 p-5">
            {u.is_admin || id === admin.userId ? (
              <p className="text-sm text-muted">
                {id === admin.userId ? "You can't delete your own account from here." : "This is an admin account. Remove their admin access in Admin team before deleting it."}
              </p>
            ) : (
              <AdminForm action={deleteUserAccount}>
                <input type="hidden" name="userId" value={id} />
                <div className="flex items-start gap-3">
                  <IconAlert className="mt-0.5 shrink-0 text-missed" />
                  <div>
                    <p className="text-sm font-semibold">Delete this account permanently</p>
                    <p className="text-xs text-muted">
                      Removes the sign-in, all actions, history, reasons, goals, recovery plans and push devices. This can&apos;t be undone. Usage analytics are kept without a link to the person. The deletion is recorded in the audit log.
                    </p>
                  </div>
                </div>
                <label htmlFor="delete-reason" className="block text-sm font-semibold">
                  Reason
                </label>
                <input id="delete-reason" name="reason" required minLength={5} maxLength={500} placeholder="e.g. User request, ticket #123" className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm" />
                <label htmlFor="delete-confirm" className="block text-sm font-semibold">
                  Type <span className="select-all font-mono text-missed">{u.email}</span> to confirm
                </label>
                <input id="delete-confirm" name="confirmEmail" required autoComplete="off" spellCheck={false} className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm" />
                <SubmitButton variant="danger">Delete account permanently</SubmitButton>
              </AdminForm>
            )}
          </Card>
        </>
      )}
    </>
  );
}
