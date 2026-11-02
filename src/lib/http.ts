import "server-only";
import { NextResponse } from "next/server";

/** Reject cross-site POSTs (simple CSRF defence for cookie-authenticated routes). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("x-forwarded-host");
  } catch {
    return false;
  }
}

export async function readJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new Error("too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
export const noContent = () => new NextResponse(null, { status: 204 });
