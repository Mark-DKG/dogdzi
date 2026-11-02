import { z } from "zod";
import { json, noContent, readJson, sameOrigin } from "@/lib/http";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Register this device for push reminders (accounts only; RLS scopes rows to the user). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) return json({ error: "Sign in to enable push reminders." }, 401);
  let body: z.infer<typeof Sub>;
  try {
    body = Sub.parse(await readJson(req));
  } catch {
    return json({ error: "Invalid subscription." }, 400);
  }
  const row = {
    user_id: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    failure_count: 0,
  };
  const { error } = await sb.from("push_subscriptions").upsert(row, { onConflict: "endpoint" });
  if (error) return json({ error: "Couldn't save this device." }, 500);
  await sb.from("notification_preferences").update({ push_enabled: true }).eq("user_id", user.id);
  return noContent();
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) return json({ error: "unauthorized" }, 401);
  let endpoint = "";
  try {
    endpoint = z.object({ endpoint: z.string().url() }).parse(await readJson(req)).endpoint;
  } catch {
    return json({ error: "invalid" }, 400);
  }
  await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return noContent();
}
