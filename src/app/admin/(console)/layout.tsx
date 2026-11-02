import type { Metadata } from "next";
import Link from "next/link";
import { AdminSignOut } from "@/components/admin/admin-signout";
import { Monogram } from "@/components/brand/logo";
import { ADMIN_REQUIRE_MFA, requireAdmin } from "@/lib/admin/guard";
import { ADMIN_NAV, ROLE_LABELS } from "@/lib/admin/permissions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · DOGDZI Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const nav = ADMIN_NAV.filter((n) => admin.perms.has(n.perm));
  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="bg-forest-950 text-cream-100 lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Monogram height={22} tile={false} />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-forest-200">Admin</span>
          </Link>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-forest-100 hover:bg-forest-800 hover:text-cream-100">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-forest-800 p-4 lg:block">
          <p className="truncate text-xs text-forest-100" title={admin.email ?? undefined}>
            {admin.email}
          </p>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-cream-200">{ROLE_LABELS[admin.role]}</p>
          <AdminSignOut />
        </div>
      </aside>
      {!ADMIN_REQUIRE_MFA && (
        <div role="alert" className="bg-warn-bg px-5 py-2 text-center text-xs font-semibold text-warn">
          ADMIN_REQUIRE_MFA is off. Turn it on before production.
        </div>
      )}
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {children}
      </main>
    </div>
  );
}
