"use client";

import { useEffect } from "react";
import { capabilities } from "@/lib/platform";
import { registerServiceWorker } from "@/lib/push/client";

/** Registers the service worker (offline shell, notifications, push) in production. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !capabilities.serviceWorker()) return;
    const onLoad = () => void registerServiceWorker();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);
  return null;
}
