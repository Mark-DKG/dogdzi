import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/surface";
import { requireAdmin } from "@/lib/admin/guard";
import { getServiceSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin("audit:read");
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const action = (sp.action ?? "").trim().slice(0, 60);
  let q = getServiceSupabase()!
    .from("audit_log")
    .select("id, created_at, actor_id, actor_role, action, target_type, target_id, reason, ip", { count: "exact" });
  if (action) q = q.ilike("action", `${action.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (error) throw new Error("audit unavailable");

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin sign-in, view of identifiable data and change. Entries can't be edited or deleted." />
      <form action="/admin/audit" className="mb-4 flex gap-2">
        <label htmlFor="action" className="sr-only">Filter by action</label>
        <input id="action" name="action" defaultValue={action} placeholder="Filter by action, e.g. content. or admin." className="h-11 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm" />
        <button type="submit" className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg">Filter</button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="px-4 py-3">Admin</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Target</th>
              <th scope="col" className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted">{new Date(e.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs">{(e.actor_id ?? "").slice(0, 8)}</span>
                  <span className="block text-xs text-muted">{e.actor_role}</span>
                </td>
                <td className="px-4 py-2.5 font-semibold">{e.action}</td>
                <td className="px-4 py-2.5">
                  {e.target_type === "user" && e.target_id ? (
                    <Link href={`/admin/users/${e.target_id}`} className="font-mono text-xs underline">
                      user:{e.target_id.slice(0, 8)}
                    </Link>
                  ) : e.target_id ? (
                    <span className="font-mono text-xs">{e.target_type}:{e.target_id.slice(0, 12)}</span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="max-w-xs px-4 py-2.5 text-muted">{e.reason ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={`/admin/audit?action=${encodeURIComponent(action)}&page=${page - 1}`} className="font-semibold underline">← Newer</Link> : <span />}
        {(page + 1) * PAGE < (count ?? 0) && <Link href={`/admin/audit?action=${encodeURIComponent(action)}&page=${page + 1}`} className="font-semibold underline">Older →</Link>}
      </div>
    </>
  );
}
