import { z } from "zod";
import { json, noContent, readJson, sameOrigin } from "@/lib/http";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Permanently delete the signed-in account and all of its data. Requires the
 * user to type DELETE and re-enter their password.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user?.email) return json({ error: "Please sign in again." }, 401);

  let body: { confirm: string; password: string };
  try {
    body = z.object({ confirm: z.literal("DELETE"), password: z.string().min(1).max(200) }).parse(await readJson(req));
  } catch {
    return json({ error: 'Type DELETE and enter your password to confirm.' }, 400);
  }

  // Re-authenticate to make sure it's really the account owner.
  const { error: authError } = await sb.auth.signInWithPassword({ email: user.email, password: body.password });
  if (authError) return json({ error: "That password isn't right." }, 403);

  const { error } = await sb.rpc("delete_my_account");
  if (error) {
    // Fallback for projects where the function can't remove auth users directly.
    const service = getServiceSupabase();
    if (!service) return json({ error: "Account deletion isn't available right now. Please contact support." }, 500);
    const { error: purgeErr } = await service.rpc("purge_user_data", { p_user: user.id });
    if (purgeErr) {
      console.error("[dogdzi] purge failed", purgeErr.message);
      return json({ error: "We couldn't delete your account. Please try again or contact support." }, 500);
    }
    await service.auth.admin.deleteUser(user.id).catch(() => {});
  }
  await sb.auth.signOut().catch(() => {});
  return noContent();
}
