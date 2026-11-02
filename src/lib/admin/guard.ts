import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";
import { deniedRedirect, evaluateAdminAccess, type AccessResult, type AdminContext } from "./access";
import type { Permission } from "./permissions";

export const ADMIN_REQUIRE_MFA = process.env.ADMIN_REQUIRE_MFA !== "false";

export async function checkAdmin(perm?: Permission, opts: { allowAal1?: boolean } = {}): Promise<AccessResult> {
  const sb = await getServerSupabase();
  const service = getServiceSupabase();
  return evaluateAdminAccess(
    {
      configured: isSupabaseConfigured && !!service,
      requireMfa: ADMIN_REQUIRE_MFA,
      getUser: async () => {
        const { data } = await sb!.auth.getUser();
        return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
      },
      getAal: async () => {
        const { data } = await sb!.auth.mfa.getAuthenticatorAssuranceLevel();
        return data?.currentLevel === "aal2" ? "aal2" : "aal1";
      },
      getAdminRecord: async (userId) => {
        const [{ data: row }, { data: grants }] = await Promise.all([
          service!.from("admin_users").select("role, disabled_at").eq("user_id", userId).maybeSingle(),
          service!.from("admin_permission_grants").select("permission").eq("admin_user_id", userId),
        ]);
        if (!row) return null;
        return { role: row.role as string, disabledAt: row.disabled_at as string | null, grants: (grants ?? []).map((g) => g.permission as string) };
      },
    },
    perm,
    opts,
  );
}

/** Use at the top of every admin page and server action. Redirects when access is denied. */
export async function requireAdmin(perm?: Permission): Promise<AdminContext> {
  const res = await checkAdmin(perm);
  if (!res.ok) redirect(deniedRedirect(res.reason));
  return res.admin;
}

export interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append to the audit log. Throws if the entry can't be written, so callers
 * that perform sensitive operations fail closed rather than act unlogged.
 */
export async function audit(admin: Pick<AdminContext, "userId" | "role">, entry: AuditEntry): Promise<void> {
  const service = getServiceSupabase();
  if (!service) throw new Error("Audit log unavailable");
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  const { error } = await service.from("audit_log").insert({
    actor_id: admin.userId,
    actor_role: admin.role,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    reason: entry.reason ?? null,
    metadata: entry.metadata ?? {},
    ip,
    user_agent: (h.get("user-agent") ?? "").slice(0, 300) || null,
  });
  if (error) {
    console.error("[dogdzi] audit write failed", error);
    throw new Error("Couldn't write the audit log, so the operation was stopped.");
  }
}
