import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { deniedRedirect, evaluateAdminAccess, type AccessDeps } from "../src/lib/admin/access";
import { ADMIN_ROLES, checkAccountDeletion, checkGrant, checkRoleChange, effectivePermissions, PERMISSIONS, ROLE_PERMISSIONS, WRITE_PERMISSIONS } from "../src/lib/admin/permissions";

const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const SQL = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(new URL(f, MIGRATIONS), "utf8"))
  .join("\n");

test("role matrix: read-only admins can never write; support can't manage admins or settings", () => {
  for (const p of ROLE_PERMISSIONS.readonly_admin) assert.ok(!WRITE_PERMISSIONS.has(p), `${p} must not be writable for readonly`);
  const support = effectivePermissions("support_admin");
  assert.ok(support.has("accounts:write"));
  assert.ok(support.has("content:read"));
  assert.ok(!support.has("content:write"), "content writes need an explicit grant");
  assert.ok(!support.has("admins:manage"));
  assert.ok(!support.has("settings:manage"));
  assert.ok(!support.has("analytics:user_level"), "identifiable analytics need an explicit grant");
  assert.equal(effectivePermissions("super_admin").size, PERMISSIONS.length);
});

test("grants: only grantable permissions, never write access for read-only", () => {
  assert.ok(effectivePermissions("support_admin", ["content:write"]).has("content:write"));
  assert.ok(!effectivePermissions("readonly_admin", ["content:write", "accounts:write"]).has("content:write"));
  assert.ok(!effectivePermissions("support_admin", ["admins:manage"]).has("admins:manage"), "admins:manage is role-only");
  assert.ok(!effectivePermissions("support_admin", ["bogus:perm"]).has("bogus:perm" as never));
  const superP = effectivePermissions("super_admin");
  assert.equal(checkGrant({ actorPerms: superP, actorId: "a", targetId: "b", targetRole: "readonly_admin", permission: "content:write" }), "Read-only admins can't be given write access.");
  assert.equal(checkGrant({ actorPerms: superP, actorId: "a", targetId: "a", targetRole: "super_admin", permission: "audit:read" }), "You can't change your own permissions.");
  assert.equal(checkGrant({ actorPerms: effectivePermissions("support_admin"), actorId: "a", targetId: "b", targetRole: "support_admin", permission: "audit:read" }), "You don't have permission to manage admins.");
  assert.equal(checkGrant({ actorPerms: superP, actorId: "a", targetId: "b", targetRole: "support_admin", permission: "content:write" }), null);
});

test("role changes: no self-changes, always one super admin", () => {
  const superP = effectivePermissions("super_admin");
  const base = { actorId: "a", actorPerms: superP, targetId: "b", targetCurrentRole: "super_admin" as const, activeSuperAdmins: 2 };
  assert.equal(checkRoleChange({ ...base, newRole: "support_admin" }), null);
  assert.match(checkRoleChange({ ...base, newRole: null, activeSuperAdmins: 1 })!, /at least one super admin/);
  assert.match(checkRoleChange({ ...base, targetId: "a", newRole: "readonly_admin" })!, /your own/);
  assert.match(checkRoleChange({ ...base, actorPerms: effectivePermissions("support_admin"), newRole: null })!, /permission/);
});

function deps(over: Partial<AccessDeps> = {}): AccessDeps {
  return {
    configured: true,
    requireMfa: true,
    getUser: async () => ({ id: "u1", email: "staff@example.com" }),
    getAal: async () => "aal2",
    getAdminRecord: async () => ({ role: "support_admin", disabledAt: null, grants: [] }),
    ...over,
  };
}

test("admin access: every denial path and the happy path", async () => {
  assert.deepEqual(await evaluateAdminAccess(deps({ configured: false })), { ok: false, reason: "not_configured" });
  assert.deepEqual(await evaluateAdminAccess(deps({ getUser: async () => null })), { ok: false, reason: "unauthenticated" });
  assert.deepEqual(await evaluateAdminAccess(deps({ getAdminRecord: async () => null })), { ok: false, reason: "not_admin" }, "a normal user account is not an admin");
  assert.deepEqual(await evaluateAdminAccess(deps({ getAdminRecord: async () => ({ role: "god_mode", disabledAt: null, grants: [] }) })), { ok: false, reason: "not_admin" });
  assert.deepEqual(await evaluateAdminAccess(deps({ getAdminRecord: async () => ({ role: "super_admin", disabledAt: "2026-01-01", grants: [] }) })), { ok: false, reason: "disabled" });
  assert.deepEqual(await evaluateAdminAccess(deps({ getAal: async () => "aal1" })), { ok: false, reason: "mfa_required" });
  assert.equal((await evaluateAdminAccess(deps({ getAal: async () => "aal1" }), undefined, { allowAal1: true })).ok, true);
  assert.equal((await evaluateAdminAccess(deps({ getAal: async () => "aal1", requireMfa: false }))).ok, true);
  assert.deepEqual(await evaluateAdminAccess(deps(), "admins:manage"), { ok: false, reason: "forbidden" });
  assert.deepEqual(await evaluateAdminAccess(deps(), "content:write"), { ok: false, reason: "forbidden" });
  const ok = await evaluateAdminAccess(deps({ getAdminRecord: async () => ({ role: "support_admin", disabledAt: null, grants: ["content:write"] }) }), "content:write");
  assert.equal(ok.ok, true);
  assert.equal(deniedRedirect("mfa_required"), "/admin/mfa");
  assert.equal(deniedRedirect("forbidden"), "/admin?error=forbidden");
});

test("account deletion: super admins only, never self or another admin, email must match", () => {
  const superP = effectivePermissions("super_admin");
  const base = { actorPerms: superP, actorId: "a", targetId: "u", targetEmail: "Ama@Example.com", confirmEmail: " ama@example.com ", targetIsAdmin: false };
  assert.equal(checkAccountDeletion(base), null);
  assert.ok(!effectivePermissions("support_admin", ["accounts:delete"]).has("accounts:delete"), "deletion can't be granted individually");
  assert.match(checkAccountDeletion({ ...base, actorPerms: effectivePermissions("support_admin") })!, /super admins/);
  assert.match(checkAccountDeletion({ ...base, targetId: "a" })!, /own account/);
  assert.match(checkAccountDeletion({ ...base, targetIsAdmin: true })!, /admin access/);
  assert.match(checkAccountDeletion({ ...base, confirmEmail: "someone@else.com" })!, /email/);
});

test("SQL seed matches the TypeScript permission matrix", () => {
  const inserts = SQL.split("insert into public.role_permissions").slice(1).map((s) => s.slice(0, s.indexOf(";")));
  const pairs = new Set(inserts.flatMap((s) => Array.from(s.matchAll(/\('(\w+)',\s*'([\w:]+)'\)/g), (m) => `${m[1]}|${m[2]}`)));
  const expected = new Set(ADMIN_ROLES.flatMap((r) => ROLE_PERMISSIONS[r].map((p) => `${r}|${p}`)));
  assert.deepEqual([...pairs].sort(), [...expected].sort());
  for (const p of PERMISSIONS) assert.ok(SQL.includes(`('${p}',`), `permission ${p} is seeded`);
});
