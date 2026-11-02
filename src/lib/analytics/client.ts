"use client";

import { track as vercelTrack } from "@vercel/analytics";
import { uuid } from "@/lib/domain/ids";
import { isStandalone } from "@/lib/platform";
import { detectPlatform, sanitizeProps, VERCEL_EVENTS, type EventName, type Platform } from "./policy";

const CONSENT_KEY = "dogdzi:consent:v1";
const GUEST_ID_KEY = "dogdzi:guest-id";

export type ConsentMode = "opt-in" | "opt-out";
export const CONSENT_MODE: ConsentMode = process.env.NEXT_PUBLIC_ANALYTICS_CONSENT_MODE === "opt-out" ? "opt-out" : "opt-in";

export interface ConsentState {
  analytics: boolean;
  decidedAt: string;
}

const listeners = new Set<() => void>();
export function onConsentChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentState) : null;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics, decidedAt: new Date().toISOString() }));
    if (!analytics) localStorage.removeItem(GUEST_ID_KEY);
  } catch {
    /* storage unavailable: treat as session-only choice */
  }
  listeners.forEach((l) => l());
}

function privacySignal(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
}

/** True only when product analytics may run for this visitor. */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  const c = readConsent();
  if (c) return c.analytics;
  return CONSENT_MODE === "opt-out" && !privacySignal();
}

/** Random, analytics-only identifier for guests. Created only after consent. */
export function guestAnalyticsId(): string | null {
  if (!analyticsAllowed()) return null;
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function clientPlatform(): { platform: Platform; displayMode: "browser" | "standalone" } {
  const standalone = isStandalone();
  return { platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints), displayMode: standalone ? "standalone" : "browser" };
}

export function sendTelemetry(body: Record<string, unknown>, beacon = false) {
  const json = JSON.stringify(body);
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", new Blob([json], { type: "application/json" }));
      return;
    }
    void fetch("/api/telemetry", { method: "POST", body: json, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* analytics must never break the app */
  }
}

/** Record a product event. Silently does nothing without consent. */
export function trackEvent(name: EventName, props: Record<string, unknown> = {}) {
  if (!analyticsAllowed()) return;
  const safe = sanitizeProps(props);
  const { platform } = clientPlatform();
  sendTelemetry({ kind: "event", name, props: safe, guestId: guestAnalyticsId(), platform });
  if (VERCEL_EVENTS.has(name)) {
    try {
      vercelTrack(name, safe);
    } catch {
      /* ignore */
    }
  }
}
