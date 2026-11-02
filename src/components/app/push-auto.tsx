"use client";

import { useEffect } from "react";
import { useData } from "@/components/app/data-provider";
import { pushConfigured, pushSupported, requestNotificationPermission, subscribeToPush } from "@/lib/push/client";

const ASKED_KEY = "dogdzi:push-asked";
const SYNCED_KEY = "dogdzi:push-synced";

/**
 * Push reminders are on by default for accounts. When notifications are
 * already allowed, this device is subscribed quietly. Otherwise the browser's
 * permission prompt is shown once per device, on the first tap or key press
 * (browsers only allow it after a user gesture).
 */
export function PushAutoEnable() {
  const { mode, status, snapshot } = useData();
  const wanted = mode === "account" && status === "ready" && snapshot.preferences.pushEnabled;

  useEffect(() => {
    if (!wanted || !pushConfigured || !pushSupported()) return;
    const sync = () => {
      try {
        if (sessionStorage.getItem(SYNCED_KEY)) return;
        sessionStorage.setItem(SYNCED_KEY, "1");
      } catch {
        /* storage unavailable: subscribing again is harmless */
      }
      void subscribeToPush();
    };
    if (Notification.permission === "granted") {
      sync();
      return;
    }
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {
      return;
    }
    const ask = async () => {
      remove();
      try {
        localStorage.setItem(ASKED_KEY, new Date().toISOString());
      } catch {
        /* ignore */
      }
      if ((await requestNotificationPermission()) === "granted") sync();
    };
    const remove = () => {
      window.removeEventListener("pointerup", ask);
      window.removeEventListener("keydown", ask);
    };
    window.addEventListener("pointerup", ask, { once: true });
    window.addEventListener("keydown", ask, { once: true });
    return remove;
  }, [wanted]);

  return null;
}
