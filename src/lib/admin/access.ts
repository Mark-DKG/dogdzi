/**
 * Admin access decision, separated from Next.js/Supabase so it can be tested
 * with fakes. src/lib/admin/guard.ts wires in the real dependencies.
 */
import { effectivePermissions, isAdminRole, type AdminRole, type Permission } from "./permissions";

export interface AdminContext {
  userId: string;
  email: string | null;
  role: AdminRole;
  perms: Set<Permission>;
  aal: "aal1" | "aal2";
}

export type AccessDenied = "not_configured" | "unauthenticated" | "not_admin" | "disabled" | "mfa_required" | "forbidden";
export type AccessResult = { ok: true; admin: AdminContext } | { ok: false; reason: AccessDenied };

export interface AccessDeps {
  configured: boolean;
  requireMfa: boolean;
  getUser(): Promise<{ id: string; email: string | null } | null>;
  getAal(): Promise<"aal1" | "aal2">;
  getAdminRecord(userId: string): Promise<{ role: string; disabledAt: string | null; grants: string[] } | null>;
}

export async function evaluateAdminAccess(deps: AccessDeps, perm?: Permission, opts: { allowAal1?: boolean } = {}): Promise<AccessResult> {
  if (!deps.configured) return { ok: false, reason: "not_configured" };
  const user = await deps.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  const rec = await deps.getAdminRecord(user.id);
  if (!rec || !isAdminRole(rec.role)) return { ok: false, reason: "not_admin" };
  if (rec.disabledAt) return { ok: false, reason: "disabled" };
  const aal = await deps.getAal();
  if (deps.requireMfa && aal !== "aal2" && !opts.allowAal1) return { ok: false, reason: "mfa_required" };
  const perms = effectivePermissions(rec.role, rec.grants);
  if (perm && !perms.has(perm)) return { ok: false, reason: "forbidden" };
  return { ok: true, admin: { userId: user.id, email: user.email, role: rec.role, perms, aal } };
}

/** Where to send someone who was denied. */
export function deniedRedirect(reason: AccessDenied): string {
  switch (reason) {
    case "not_configured":
    case "unauthenticated":
      return "/admin/signin";
    case "mfa_required":
      return "/admin/mfa";
    case "not_admin":
    case "disabled":
      return "/admin/signin?error=no_access";
    case "forbidden":
      return "/admin?error=forbidden";
  }
}
