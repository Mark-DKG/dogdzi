"use server";

/*
 * Admin server actions. Each one: checks the permission server-side, validates
 * input, performs the change with the service role, and writes the audit log.
 * Nothing here can edit or delete a user's history; content:write may only
 * append an annotation.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, checkAdmin, requireAdmin } from "@/lib/admin/guard";
import { ADMIN_ROLES, checkGrant, checkRoleChange, isAdminRole } from "@/lib/admin/permissions";
import { uuid } from "@/lib/domain/ids";
import { SITE_URL } from "@/lib/supabase/config";
import { getServiceSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function service() {
  const s = getServiceSupabase();
  if (!s) throw new Error("Admin service is not configured.");
  return s;
}

const uuidSchema = z.string().uuid();

/** Called after sign-in / MFA so console access is on the audit trail. */
export async function recordConsoleSignIn(): Promise<void> {
  const res = await checkAdmin(undefined, { allowAal1: true });
  if (!res.ok) return;
  await audit(res.admin, { action: "admin.signin", metadata: { aal: res.admin.aal } });
}

/* ───────────────────────────── accounts ───────────────────────────── */

export async function setSuspended(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("accounts:write");
  const parsed = z
    .object({ userId: uuidSchema, suspend: z.enum(["true", "false"]), reason: z.string().trim().min(5, "Give a reason (at least 5 characters).").max(500) })
    .safeParse({ userId: form.get("userId"), suspend: form.get("suspend"), reason: form.get("reason") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { userId, reason } = parsed.data;
  const suspend = parsed.data.suspend === "true";
  if (userId === admin.userId) return { ok: false, message: "You can't suspend your own account." };
  const sb = service();
  const { data: target } = await sb.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (target && !admin.perms.has("admins:manage")) return { ok: false, message: "Only super admins can suspend admin accounts." };
  await audit(admin, { action: suspend ? "account.suspend" : "account.restore", targetType: "user", targetId: userId, reason });
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: suspend ? "876000h" : "none" });
  if (error) return { ok: false, message: "Couldn't update the account." };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: suspend ? "Account suspended. The user can no longer sign in." : "Account restored." };
}

export async function sendPasswordReset(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("accounts:write");
  const userId = uuidSchema.safeParse(form.get("userId"));
  if (!userId.success) return { ok: false, message: "Invalid user." };
  const sb = service();
  const { data } = await sb.auth.admin.getUserById(userId.data);
  const email = data.user?.email;
  if (!email) return { ok: false, message: "This account has no email address." };
  await audit(admin, { action: "account.password_reset_sent", targetType: "user", targetId: userId.data });
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/callback?next=/update-password` });
  return error ? { ok: false, message: "Couldn't send the email." } : { ok: true, message: `Reset link sent to ${email}.` };
}

/* ───────────────────────────── content ───────────────────────────── */

/** Record why content is being viewed, then open it. Content is only shown with a matching audit entry. */
export async function requestContentAccess(form: FormData): Promise<void> {
  const admin = await requireAdmin("content:read");
  const userId = uuidSchema.parse(form.get("userId"));
  const reason = z.string().trim().min(10).max(500).safeParse(form.get("reason"));
  if (!reason.success) redirect(`/admin/users/${userId}?content_error=reason`);
  const grant = uuid();
  await audit(admin, { action: "content.view", targetType: "user", targetId: userId, reason: reason.data, metadata: { grant } });
  redirect(`/admin/users/${userId}?content=${grant}`);
}

export async function addAnnotation(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("content:write");
  const parsed = z
    .object({ userId: uuidSchema, actionId: uuidSchema, note: z.string().trim().min(3, "Write a short note.").max(500) })
    .safeParse({ userId: form.get("userId"), actionId: form.get("actionId"), note: form.get("note") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { userId, actionId, note } = parsed.data;
  const sb = service();
  const { data: action } = await sb.from("actions").select("id").eq("id", actionId).eq("user_id", userId).maybeSingle();
  if (!action) return { ok: false, message: "That action doesn't belong to this user." };
  await audit(admin, { action: "content.annotate", targetType: "action", targetId: actionId, metadata: { userId } });
  const { error } = await sb.from("action_history").insert({
    id: uuid(),
    user_id: userId,
    action_id: actionId,
    event_type: "admin_annotation",
    data: { note, by: "DOGDZI support" },
  });
  if (error) return { ok: false, message: "Couldn't add the note." };
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: "Support note appended to the history. Existing entries are unchanged." };
}

/* ───────────────────────────── admin team ───────────────────────────── */

async function superAdminCount(): Promise<number> {
  const { count } = await service().from("admin_users").select("user_id", { count: "exact", head: true }).eq("role", "super_admin").is("disabled_at", null);
  return count ?? 0;
}

export async function addAdmin(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("admins:manage");
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(ADMIN_ROLES) }).safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { ok: false, message: "Enter a valid email and role." };
  const sb = service();
  const { data } = await sb.rpc("admin_list_users", { p_search: parsed.data.email, p_limit: 5, p_offset: 0 });
  const match = (data as { id: string; email: string }[] | null)?.find((u) => u.email.toLowerCase() === parsed.data.email);
  if (!match) return { ok: false, message: "No account with that email. Ask them to sign up first, ideally with a dedicated staff email." };
  const err = checkRoleChange({ actorId: admin.userId, actorPerms: admin.perms, targetId: match.id, targetCurrentRole: null, newRole: parsed.data.role, activeSuperAdmins: await superAdminCount() });
  if (err) return { ok: false, message: err };
  await audit(admin, { action: "admin.add", targetType: "user", targetId: match.id, metadata: { role: parsed.data.role } });
  const { error } = await sb.from("admin_users").insert({ user_id: match.id, role: parsed.data.role, created_by: admin.userId });
  if (error) return { ok: false, message: error.code === "23505" ? "That account is already an admin." : "Couldn't add the admin." };
  revalidatePath("/admin/team");
  return { ok: true, message: `${parsed.data.email} added. They must set up an authenticator app on first sign-in.` };
}

export async function changeAdmin(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("admins:manage");
  const parsed = z
    .object({ userId: uuidSchema, op: z.enum(["role", "disable", "enable", "remove"]), role: z.string().optional() })
    .safeParse({ userId: form.get("userId"), op: form.get("op"), role: form.get("role") ?? undefined });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { userId, op } = parsed.data;
  const sb = service();
  const { data: target } = await sb.from("admin_users").select("role, disabled_at").eq("user_id", userId).maybeSingle();
  if (!target || !isAdminRole(target.role)) return { ok: false, message: "That admin no longer exists." };
  const newRole = op === "role" ? parsed.data.role : op === "remove" || op === "disable" ? null : target.role;
  if (op === "role" && !isAdminRole(newRole)) return { ok: false, message: "Unknown role." };
  const err = checkRoleChange({
    actorId: admin.userId,
    actorPerms: admin.perms,
    targetId: userId,
    targetCurrentRole: target.role,
    newRole: (newRole ?? null) as never,
    activeSuperAdmins: await superAdminCount(),
  });
  if (err) return { ok: false, message: err };
  await audit(admin, { action: `admin.${op}`, targetType: "user", targetId: userId, metadata: { from: target.role, to: newRole } });
  const q =
    op === "remove"
      ? sb.from("admin_users").delete().eq("user_id", userId)
      : op === "role"
        ? sb.from("admin_users").update({ role: newRole }).eq("user_id", userId)
        : sb.from("admin_users").update({ disabled_at: op === "disable" ? new Date().toISOString() : null }).eq("user_id", userId);
  const { error } = await q;
  if (error) return { ok: false, message: "Couldn't update the admin." };
  revalidatePath("/admin/team");
  return { ok: true, message: "Admin access updated." };
}

export async function setGrant(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("admins:manage");
  const userId = uuidSchema.safeParse(form.get("userId"));
  const permission = String(form.get("permission") ?? "");
  const on = form.get("on") === "true";
  if (!userId.success) return { ok: false, message: "Invalid admin." };
  const sb = service();
  const { data: target } = await sb.from("admin_users").select("role").eq("user_id", userId.data).maybeSingle();
  if (!target || !isAdminRole(target.role)) return { ok: false, message: "That admin no longer exists." };
  const err = checkGrant({ actorPerms: admin.perms, actorId: admin.userId, targetId: userId.data, targetRole: target.role, permission });
  if (err) return { ok: false, message: err };
  await audit(admin, { action: on ? "admin.grant" : "admin.revoke", targetType: "user", targetId: userId.data, metadata: { permission } });
  const { error } = on
    ? await sb.from("admin_permission_grants").upsert({ admin_user_id: userId.data, permission, granted_by: admin.userId })
    : await sb.from("admin_permission_grants").delete().eq("admin_user_id", userId.data).eq("permission", permission);
  if (error) return { ok: false, message: "Couldn't update permissions." };
  revalidatePath("/admin/team");
  return { ok: true, message: on ? `Granted ${permission}.` : `Revoked ${permission}.` };
}

/* ───────────────────────────── settings ───────────────────────────── */

export async function saveAnnouncement(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin("settings:manage");
  const parsed = z.object({ text: z.string().trim().max(280), active: z.boolean() }).safeParse({ text: form.get("text") ?? "", active: form.get("active") === "on" });
  if (!parsed.success) return { ok: false, message: "Keep the announcement under 280 characters." };
  if (parsed.data.active && !parsed.data.text) return { ok: false, message: "Write the announcement text before turning it on." };
  await audit(admin, { action: "settings.announcement", targetType: "setting", targetId: "announcement", metadata: parsed.data });
  const { error } = await service().from("system_settings").upsert({ key: "announcement", value: parsed.data, updated_at: new Date().toISOString(), updated_by: admin.userId });
  if (error) return { ok: false, message: "Couldn't save." };
  revalidatePath("/admin/settings");
  return { ok: true, message: parsed.data.active ? "Announcement is live in the app." : "Announcement saved (hidden)." };
}
