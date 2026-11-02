import type { Metadata } from "next";
import { addAdmin, changeAdmin, setGrant } from "@/app/admin/actions";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/surface";
import { requireAdmin } from "@/lib/admin/guard";
import { ADMIN_ROLES, type AdminRole, effectivePermissions, GRANTABLE, isAdminRole, ROLE_LABELS, ROLE_PERMISSIONS, WRITE_PERMISSIONS } from "@/lib/admin/permissions";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin team" };

export default async function TeamPage() {
  const me = await requireAdmin("admins:manage");
  const sb = getServiceSupabase()!;
  const [{ data: admins }, { data: grants }] = await Promise.all([
    sb.from("admin_users").select("user_id, role, created_at, disabled_at").order("created_at"),
    sb.from("admin_permission_grants").select("admin_user_id, permission"),
  ]);
  const emails = new Map<string, string>();
  await Promise.all(
    (admins ?? []).map(async (a) => {
      const { data } = await sb.auth.admin.getUserById(a.user_id);
      emails.set(a.user_id, data.user?.email ?? "unknown");
    }),
  );

  return (
    <>
      <PageHeader title="Admin team" subtitle="Each admin signs in with their own account and an authenticator app. There is no shared login." />

      <Card className="mb-6 p-5">
        <AdminForm action={addAdmin} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
              Add an admin by email
            </label>
            <input id="email" name="email" type="email" required className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm" placeholder="staff@company.com" />
          </div>
          <div>
            <label htmlFor="role" className="mb-1.5 block text-sm font-semibold">
              Role
            </label>
            <select id="role" name="role" defaultValue="readonly_admin" className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm">
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton size="md">Add admin</SubmitButton>
        </AdminForm>
      </Card>

      <div className="space-y-3">
        {(admins ?? []).map((a) => {
          if (!isAdminRole(a.role)) return null;
          const role: AdminRole = a.role;
          const mine = (grants ?? []).filter((g) => g.admin_user_id === a.user_id).map((g) => g.permission as string);
          const perms = effectivePermissions(role, mine);
          const self = a.user_id === me.userId;
          return (
            <Card key={a.user_id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold">{emails.get(a.user_id)}</p>
                <Badge tone="brand">{ROLE_LABELS[role]}</Badge>
                {a.disabled_at && <Badge tone="missed">Disabled</Badge>}
                {self && <Badge>You</Badge>}
              </div>
              <p className="mt-2 text-xs text-muted">
                {Array.from(perms)
                  .sort()
                  .map((p) => (WRITE_PERMISSIONS.has(p) ? `${p} ✎` : p))
                  .join(" · ")}
              </p>
              {!self && (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <AdminForm action={changeAdmin} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="userId" value={a.user_id} />
                    <input type="hidden" name="op" value="role" />
                    <label htmlFor={`role-${a.user_id}`} className="sr-only">
                      Role
                    </label>
                    <select id={`role-${a.user_id}`} name="role" defaultValue={role} className="h-9 rounded-lg border border-line bg-surface px-2 text-sm">
                      {ADMIN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <SubmitButton variant="secondary">Change role</SubmitButton>
                  </AdminForm>
                  <div className="flex flex-wrap gap-2">
                    <AdminForm action={changeAdmin}>
                      <input type="hidden" name="userId" value={a.user_id} />
                      <input type="hidden" name="op" value={a.disabled_at ? "enable" : "disable"} />
                      <SubmitButton variant="secondary">{a.disabled_at ? "Re-enable" : "Disable"}</SubmitButton>
                    </AdminForm>
                    <AdminForm action={changeAdmin}>
                      <input type="hidden" name="userId" value={a.user_id} />
                      <input type="hidden" name="op" value="remove" />
                      <SubmitButton variant="danger">Remove admin access</SubmitButton>
                    </AdminForm>
                  </div>
                  <div className="lg:col-span-2">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Extra permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(GRANTABLE)
                        .filter((p) => !ROLE_PERMISSIONS[role].includes(p))
                        .filter((p) => !(role === "readonly_admin" && WRITE_PERMISSIONS.has(p)))
                        .map((p) => {
                          const on = mine.includes(p);
                          return (
                            <AdminForm key={p} action={setGrant}>
                              <input type="hidden" name="userId" value={a.user_id} />
                              <input type="hidden" name="permission" value={p} />
                              <input type="hidden" name="on" value={on ? "false" : "true"} />
                              <SubmitButton variant={on ? "primary" : "secondary"}>
                                {on ? "✓ " : "+ "}
                                {p}
                              </SubmitButton>
                            </AdminForm>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <SectionTitle>Role reference</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Role</th>
              <th scope="col" className="px-4 py-3">Permissions</th>
            </tr>
          </thead>
          <tbody>
            {ADMIN_ROLES.map((r) => (
              <tr key={r} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{ROLE_LABELS[r]}</td>
                <td className="px-4 py-3 text-muted">{ROLE_PERMISSIONS[r].join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
