"use client";

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { IconLogout } from "@/components/icons";

export function AdminSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-forest-100 hover:bg-forest-800 hover:text-cream-100"
      onClick={async () => {
        await getBrowserSupabase()?.auth.signOut();
        router.replace("/admin/signin");
        router.refresh();
      }}
    >
      <IconLogout size={16} /> Sign out
    </button>
  );
}
