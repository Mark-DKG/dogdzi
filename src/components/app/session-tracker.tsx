"use client";

import { useEffect } from "react";
import { analyticsAllowed, clearLegacyConsent, clientPlatform, guestAnalyticsId, sendTelemetry } from "@/lib/analytics/client";
import { HEARTBEAT_MS, IDLE_MS } from "@/lib/analytics/policy";
import { uuid } from "@/lib/domain/ids";

/**
 * Estimates time spent in the app: a session starts when the app is used,
 * heartbeats every minute while the tab is visible and someone interacted in
 * the last 5 minutes, and ends after 5 idle minutes or when the tab closes.
 * Figures are estimates by design.
 */
export function SessionTracker({ signedIn }: { signedIn: boolean }) {
  useEffect(() => {
    let sessionId: string | null = null;
    let lastInteraction = Date.now();
    let timer: ReturnType<typeof setInterval> | null = null;

    const base = () => ({ ...clientPlatform(), guestId: signedIn ? null : guestAnalyticsId() });
    const start = () => {
      if (!analyticsAllowed() || sessionId) return;
      sessionId = uuid();
      sendTelemetry({ kind: "session", op: "start", sessionId, ...base() });
    };
    const end = (beacon = false) => {
      if (!sessionId) return;
      sendTelemetry({ kind: "session", op: "end", sessionId, ...base() }, beacon);
      sessionId = null;
    };
    const beat = () => {
      if (!analyticsAllowed()) return end();
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInteraction > IDLE_MS) return end();
      if (!sessionId) return start();
      sendTelemetry({ kind: "session", op: "beat", sessionId, ...base() });
    };
    const interact = () => {
      lastInteraction = Date.now();
      if (!sessionId && document.visibilityState === "visible") start();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (sessionId) sendTelemetry({ kind: "session", op: "beat", sessionId, ...base() }, true);
      } else interact();
    };
    const onHide = () => end(true);

    clearLegacyConsent();
    start();
    timer = setInterval(beat, HEARTBEAT_MS);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, interact, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      if (timer) clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, interact));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      end(true);
    };
  }, [signedIn]);
  return null;
}
