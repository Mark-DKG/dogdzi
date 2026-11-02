import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/** Exchanges the PKCE code from email links (sign-up confirmation, password reset). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const sb = await getServerSupabase();
  if (code && sb) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/signin?error=link", url.origin));
}

/** Only allow same-site relative redirects. */
function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/app";
}
