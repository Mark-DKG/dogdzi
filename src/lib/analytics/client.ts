"use client";

import { track as vercelTrack } from "@vercel/analytics";
import { uuid } from "@/lib/domain/ids";
import { isStandalone } from "@/lib/platform";
import { detectPlatform, sanitizeProps, VERCEL_EVENTS, type EventName, type Platform } from "./policy";

const GUEST_ID_KEY = "dogdzi:guest-id";
const LEGACY_CONSENT_KEY = "dogdzi:consent:v1";
/** Set to "off" when someone turns analytics off in Settings. On by default. */
const ANALYTICS_KEY = "dogdzi:analytics";

const listeners = new Set<() => void>();
export function onAnalyticsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Usage analytics are on unless this browser has turned them off in Settings. */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ANALYTICS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAnalyticsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(ANALYTICS_KEY);
    else {
      localStorage.setItem(ANALYTICS_KEY, "off");
      localStorage.removeItem(GUEST_ID_KEY);
    }
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** Remove the old analytics-choice key left by earlier versions. */
export function clearLegacyConsent() {
  try {
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Random, analytics-only identifier for guests. */
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

/** Record a product event (unless analytics are off). Never includes action titles, notes or reasons. */
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
