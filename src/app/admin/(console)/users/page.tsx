import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui/surface";
import { audit, requireAdmin } from "@/lib/admin/guard";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accounts" };
const PAGE = 25;

interface Row {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  last_active_at: string | null;
  is_admin: boolean;
  action_count: number;
  total_count: number;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin("accounts:read");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const { data, error } = await getServiceSupabase()!.rpc("admin_list_users", { p_search: q || null, p_limit: PAGE, p_offset: page * PAGE });
  if (error) throw new Error("accounts unavailable");
  const rows = (data as Row[]) ?? [];
  const total = rows[0]?.total_count ?? 0;
  await audit(admin, { action: "accounts.list", metadata: { q: q || null, page } });

  return (
    <>
      <PageHeader title="Accounts" subtitle={`${total} ${q ? "matching" : "total"}`} />
      {sp.deleted && (
        <p role="status" className="mb-4 rounded-xl bg-done-bg px-3.5 py-2.5 text-sm font-medium text-done">
          {sp.deleted.slice(0, 320)} was permanently deleted. The deletion is recorded in the audit log.
        </p>
      )}
      <form className="mb-4 flex gap-2" action="/admin/users">
        <label htmlFor="q" className="sr-only">
          Search by email
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by email" className="h-11 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm" />
        <button type="submit" className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">
          Search
        </button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Joined</th>
              <th scope="col" className="px-4 py-3">Last active</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No accounts found.
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const banned = u.banned_until && new Date(u.banned_until) > new Date();
              return (
                <tr key={u.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {u.email}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-muted">{fmt(u.last_active_at ?? u.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.action_count}</td>
                  <td className="space-x-1 px-4 py-3">
                    {banned ? <Badge tone="missed">Suspended</Badge> : <Badge tone="done">Active</Badge>}
                    {u.is_admin && <Badge tone="brand">Admin</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page - 1}`} className="font-semibold underline">← Previous</Link> : <span />}
        {(page + 1) * PAGE < total && <Link href={`/admin/users?q=${encodeURIComponent(q)}&page=${page + 1}`} className="font-semibold underline">Next →</Link>}
      </div>
    </>
  );
}
