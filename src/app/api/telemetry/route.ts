import { z } from "zod";
import { applyHeartbeat, EVENT_NAMES, sanitizeProps } from "@/lib/analytics/policy";
import { json, noContent, readJson, sameOrigin } from "@/lib/http";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const platform = z.enum(["android", "ios", "desktop", "other"]).default("other");

const SessionMsg = z.object({
  kind: z.literal("session"),
  op: z.enum(["start", "beat", "end"]),
  sessionId: z.string().uuid(),
  guestId: z.string().uuid().nullable().optional(),
  platform,
  displayMode: z.enum(["browser", "standalone"]).default("browser"),
});

const EventMsg = z.object({
  kind: z.literal("event"),
  name: z.enum(EVENT_NAMES),
  props: z.record(z.unknown()).optional(),
  guestId: z.string().uuid().nullable().optional(),
  platform,
});

const Msg = z.discriminatedUnion("kind", [SessionMsg, EventMsg]);

/**
 * First-party product analytics. The client only calls this after the visitor
 * has allowed analytics. Stores no content: event names and a few enum props.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const service = getServiceSupabase();
  if (!service) return noContent(); // analytics not configured: accept and drop

  let msg: z.infer<typeof Msg>;
  try {
    msg = Msg.parse(await readJson(req, 2048));
  } catch {
    return json({ error: "invalid" }, 400);
  }

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  const isGuest = !user;
  const guestId = isGuest ? (msg.guestId ?? null) : null;
  if (isGuest && !guestId) return json({ error: "guest id required" }, 400);

  if (msg.kind === "event") {
    const { error } = await service.from("analytics_events").insert({
      name: msg.name,
      user_id: user?.id ?? null,
      guest_id: guestId,
      is_guest: isGuest,
      platform: msg.platform,
      props: sanitizeProps(msg.props),
    });
    if (error) console.error("[dogdzi] telemetry event", error.message);
    return noContent();
  }

  if (msg.op === "start") {
    const { error } = await service.from("app_sessions").upsert(
      { id: msg.sessionId, user_id: user?.id ?? null, guest_id: guestId, is_guest: isGuest, platform: msg.platform, display_mode: msg.displayMode },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) console.error("[dogdzi] telemetry start", error.message);
    if (user) await service.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", user.id);
    return noContent();
  }

  const { data: row } = await service
    .from("app_sessions")
    .select("user_id, guest_id, is_guest, last_seen_at, active_seconds, ended_at")
    .eq("id", msg.sessionId)
    .maybeSingle();
  if (!row) return noContent();
  // Only the session's owner may extend it.
  const owns = isGuest ? row.is_guest && row.guest_id === guestId : row.user_id === user!.id;
  if (!owns) return json({ error: "forbidden" }, 403);
  const update = applyHeartbeat(row, new Date(), msg.op);
  if (update) await service.from("app_sessions").update(update).eq("id", msg.sessionId);
  return noContent();
}
