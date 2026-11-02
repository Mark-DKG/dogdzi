/**
 * Admin role-based access control. Pure and dependency-free so it can be
 * enforced on the server and unit-tested. Mirrored by the seed data in
 * supabase/migrations/0001_init.sql (a test checks they match).
 */

export const ADMIN_ROLES = ["super_admin", "support_admin", "readonly_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "accounts:read",
  "accounts:write",
  "accounts:delete",
  "content:read",
  "content:write",
  "analytics:read",
  "analytics:user_level",
  "audit:read",
  "admins:manage",
  "settings:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const WRITE_PERMISSIONS: ReadonlySet<Permission> = new Set(["accounts:write", "accounts:delete", "content:write", "admins:manage", "settings:manage"]);

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  support_admin: ["accounts:read", "accounts:write", "content:read", "analytics:read"],
  readonly_admin: ["accounts:read", "analytics:read"],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  support_admin: "Support Admin",
  readonly_admin: "Read-only Admin",
};

/** Permissions that may be granted individually on top of a role. */
export const GRANTABLE: ReadonlySet<Permission> = new Set(["content:read", "content:write", "analytics:user_level", "audit:read"]);

export function isAdminRole(v: unknown): v is AdminRole {
  return typeof v === "string" && (ADMIN_ROLES as readonly string[]).includes(v);
}

/**
 * Effective permissions = role permissions + explicit grants.
 * Read-only admins can never receive a write permission, and only grantable
 * permissions are honoured, whatever the grants table says.
 */
export function effectivePermissions(role: AdminRole, grants: readonly string[] = []): Set<Permission> {
  const out = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const g of grants) {
    if (!(PERMISSIONS as readonly string[]).includes(g)) continue;
    const p = g as Permission;
    if (!GRANTABLE.has(p)) continue;
    if (role === "readonly_admin" && WRITE_PERMISSIONS.has(p)) continue;
    out.add(p);
  }
  return out;
}

export function can(perms: ReadonlySet<Permission>, p: Permission): boolean {
  return perms.has(p);
}

export interface RoleChangeCheck {
  actorId: string;
  actorPerms: ReadonlySet<Permission>;
  targetId: string;
  targetCurrentRole: AdminRole | null;
  newRole: AdminRole | null; // null = remove admin access
  activeSuperAdmins: number;
}

/** Guard rails for permanently deleting a user's account. Returns an error message, or null when allowed. */
export function checkAccountDeletion(c: { actorPerms: ReadonlySet<Permission>; actorId: string; targetId: string; targetEmail: string | null; confirmEmail: string; targetIsAdmin: boolean }): string | null {
  if (!c.actorPerms.has("accounts:delete")) return "Only super admins can delete accounts.";
  if (c.actorId === c.targetId) return "You can't delete your own account from the admin console.";
  if (c.targetIsAdmin) return "This is an admin account. Remove their admin access in Admin team first.";
  if (!c.targetEmail || c.confirmEmail.trim().toLowerCase() !== c.targetEmail.toLowerCase()) return "Type the account's email address exactly to confirm.";
  return null;
}

/** Guard rails for changing admin access. Returns an error message, or null when allowed. */
export function checkRoleChange(c: RoleChangeCheck): string | null {
  if (!c.actorPerms.has("admins:manage")) return "You don't have permission to manage admins.";
  if (c.actorId === c.targetId) return "You can't change your own admin role. Ask another super admin.";
  const demotingSuper = c.targetCurrentRole === "super_admin" && c.newRole !== "super_admin";
  if (demotingSuper && c.activeSuperAdmins <= 1) return "There must always be at least one super admin.";
  return null;
}

export function checkGrant(c: { actorPerms: ReadonlySet<Permission>; actorId: string; targetId: string; targetRole: AdminRole; permission: string }): string | null {
  if (!c.actorPerms.has("admins:manage")) return "You don't have permission to manage admins.";
  if (c.actorId === c.targetId) return "You can't change your own permissions.";
  if (!(PERMISSIONS as readonly string[]).includes(c.permission)) return "Unknown permission.";
  const p = c.permission as Permission;
  if (!GRANTABLE.has(p)) return "That permission comes only with a role.";
  if (c.targetRole === "readonly_admin" && WRITE_PERMISSIONS.has(p)) return "Read-only admins can't be given write access.";
  return null;
}

/** Admin console navigation, filtered by what the admin may see. */
export const ADMIN_NAV: { href: string; label: string; perm: Permission }[] = [
  { href: "/admin", label: "Overview", perm: "analytics:read" },
  { href: "/admin/analytics", label: "Analytics", perm: "analytics:read" },
  { href: "/admin/users", label: "Accounts", perm: "accounts:read" },
  { href: "/admin/audit", label: "Audit log", perm: "audit:read" },
  { href: "/admin/team", label: "Admin team", perm: "admins:manage" },
  { href: "/admin/settings", label: "Settings", perm: "settings:manage" },
];
