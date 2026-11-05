import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there. Middleware refreshes sessions.
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/**
 * Why the service-role key can't be used, or null when it looks right. Catches
 * the easy mistake of pasting the publishable key: Supabase then answers every
 * server query with 401/permission denied and features fail silently.
 */
export function serviceKeyIssue(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY is not set.";
  if (key === SUPABASE_ANON_KEY || key.startsWith("sb_publishable_")) {
    return "SUPABASE_SERVICE_ROLE_KEY holds the publishable key. Use the secret key (sb_secret_…) or the legacy service_role key.";
  }
  if (!key.startsWith("sb_secret_") && key.split(".").length !== 3) return "SUPABASE_SERVICE_ROLE_KEY doesn't look like a Supabase secret key.";
  return null;
}

/**
 * Service-role client. Bypasses RLS — use only in server code after an
 * explicit permission check. Never import this from client components.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!isSupabaseConfigured || !key) return null;
  const issue = serviceKeyIssue();
  if (issue) {
    console.error("[dogdzi]", issue);
    return null;
  }
  if (!admin) {
    admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}
