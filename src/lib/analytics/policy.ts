/**
 * What may be sent to analytics. Pure so it can run on client and server and
 * be tested. Nothing a user writes (titles, notes, reasons) is ever allowed.
 */

export const EVENT_NAMES = [
  "signup_completed",
  "guest_converted",
  "onboarding_completed",
  "action_created",
  "routine_created",
  "action_completed",
  "action_missed",
  "action_skipped",
  "recovery_plan_created",
  "goal_created",
  "push_enabled",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** Events also forwarded to Vercel Web Analytics as custom events. */
export const VERCEL_EVENTS: ReadonlySet<EventName> = new Set(["signup_completed", "guest_converted", "onboarding_completed", "action_completed"]);

const PROP_KEYS = new Set(["mode", "kind", "style", "outcome", "count", "source", "late"]);

export type SafeProps = Record<string, string | number | boolean>;

/** Keep only allow-listed keys with short enum-like strings, numbers or booleans. */
export function sanitizeProps(input: unknown): SafeProps {
  const out: SafeProps = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!PROP_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && /^[a-z0-9_]{1,32}$/.test(v)) out[k] = v;
  }
  return out;
}

export function isEventName(v: unknown): v is EventName {
  return typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
}

/** Strip identifiers and query strings from URLs before they reach any analytics provider. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
    return u.toString();
  } catch {
    return url.split("?")[0].split("#")[0];
  }
}

/* ───────────── session timing (server applies heartbeats) ───────────── */

/** A tab is considered idle after this long without interaction. */
export const IDLE_MS = 5 * 60_000;
export const HEARTBEAT_MS = 60_000;
/** Gaps longer than this between heartbeats aren't counted as active time. */
export const MAX_GAP_SECONDS = 6 * 60;
/** Heartbeats closer together than this are ignored (rate limit). */
export const MIN_BEAT_SECONDS = 15;

export interface SessionRow {
  last_seen_at: string;
  active_seconds: number;
  ended_at: string | null;
}

/** Apply a heartbeat or end signal. Returns the update, or null to ignore it. */
export function applyHeartbeat(row: SessionRow, now: Date, op: "beat" | "end"): { last_seen_at: string; active_seconds: number; ended_at: string | null } | null {
  if (row.ended_at) return null;
  const gap = (now.getTime() - new Date(row.last_seen_at).getTime()) / 1000;
  if (gap < 0) return null;
  if (op === "beat" && gap < MIN_BEAT_SECONDS) return null;
  const add = gap <= MAX_GAP_SECONDS ? Math.round(gap) : 0;
  return {
    last_seen_at: now.toISOString(),
    active_seconds: Math.min(86400, row.active_seconds + add),
    ended_at: op === "end" ? now.toISOString() : null,
  };
}

export type Platform = "android" | "ios" | "desktop" | "other";
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  if (/windows|macintosh|linux|cros/i.test(ua)) return "desktop";
  return "other";
}
