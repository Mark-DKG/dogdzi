import { safeTimeZone, toISODate, zonedToUtc } from "@/lib/domain/dates";
import { defaultPreferences } from "@/lib/domain/snapshot";
import { datesToScan, selectReminders } from "@/lib/push/dispatch";
import { sendPush, webPushReady } from "@/lib/push/send";
import { fromRow, prefsFromRows } from "@/lib/store/mappers";
import { json } from "@/lib/http";
import { getServiceSupabase, serviceKeyIssue } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Look back this far so a late or skipped cron run doesn't drop reminders. */
const WINDOW_MINUTES = 15;
const MAX_USERS_PER_RUN = 500;

/**
 * Sends due push reminders. Call every 5–10 minutes from Vercel Cron (Pro
 * plan) or any external scheduler with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const keyIssue = serviceKeyIssue();
  if (keyIssue) return json({ error: keyIssue }, 500);
  const service = getServiceSupabase();
  if (!service || !webPushReady()) return json({ skipped: "push or database not configured" });

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60000);
  const { data: enabled, error: listError } = await service.from("notification_preferences").select("*").eq("push_enabled", true).limit(MAX_USERS_PER_RUN);
  // Never report "0 users" when the query actually failed.
  if (listError) return json({ error: `Couldn't read notification settings: ${listError.message}` }, 500);
  let sent = 0;
  let removed = 0;

  for (const notif of enabled ?? []) {
    const userId = notif.user_id as string;
    const [{ data: userPrefs }, { data: subs }] = await Promise.all([
      service.from("user_preferences").select("*").eq("user_id", userId).maybeSingle(),
      service.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId),
    ]);
    if (!subs?.length) continue;
    const prefs = prefsFromRows(userPrefs, notif, defaultPreferences("UTC", now.toISOString()));
    prefs.timezone = safeTimeZone(prefs.timezone);
    const dates = datesToScan(now, prefs.timezone);
    const { data: occRows } = await service
      .from("occurrences")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "pending")
      .in("scheduled_date", dates);
    if (!occRows?.length) continue;
    const occurrences = occRows.map(fromRow.occurrences);
    const actionIds = Array.from(new Set(occurrences.map((o) => o.actionId)));
    const { data: actRows } = await service.from("actions").select("*").in("id", actionIds);
    const dayStart = zonedToUtc(toISODate(now, prefs.timezone), "00:00", prefs.timezone);
    const { data: recent } = await service
      .from("reminders")
      .select("dedupe_key, sent_at, status")
      .eq("user_id", userId)
      .gte("sent_at", new Date(now.getTime() - 36 * 3600000).toISOString());

    const plan = selectReminders({
      now,
      windowStart,
      prefs,
      actions: (actRows ?? []).map(fromRow.actions),
      occurrences,
      alreadySent: new Set((recent ?? []).map((r) => r.dedupe_key as string)),
      sentToday: (recent ?? []).filter((r) => r.status === "sent" && new Date(r.sent_at as string) >= dayStart).length,
    });

    for (const r of plan) {
      let delivered = false;
      for (const sub of subs) {
        const outcome = await sendPush(sub, { title: r.title, body: r.body, tag: r.key, url: "/app" });
        if (outcome === "sent") delivered = true;
        if (outcome === "gone") {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
      await service.from("reminders").upsert(
        {
          user_id: userId,
          occurrence_id: r.occurrenceId,
          dedupe_key: r.key,
          kind: r.kind,
          scheduled_for: r.at.toISOString(),
          status: delivered ? "sent" : "failed",
        },
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
      );
      if (delivered) sent++;
    }
  }
  return json({ ok: true, users: enabled?.length ?? 0, sent, removedSubscriptions: removed });
}
