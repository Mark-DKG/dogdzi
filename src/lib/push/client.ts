"use client";

import { capabilities, isNativeApp } from "@/lib/platform";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export const pushConfigured = Boolean(VAPID);

export function notificationsSupported(): boolean {
  return capabilities.notifications() && capabilities.serviceWorker();
}

export function pushSupported(): boolean {
  return capabilities.webPush() && capabilities.serviceWorker();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !capabilities.serviceWorker()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Ask for notification permission. Only call from a user gesture. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Subscribe this device to Web Push and register it with the account. */
export async function subscribeToPush(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isNativeApp()) return { ok: false, message: "Push reminders in the mobile app aren't available yet." };
  if (!pushSupported()) return { ok: false, message: "This browser doesn't support push notifications. On iPhone, add DOGDZI to your Home Screen first." };
  if (!pushConfigured) return { ok: false, message: "Push notifications aren't configured on this server yet." };
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return { ok: false, message: "Notifications are blocked. You can allow them in your browser's site settings." };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!reg) return { ok: false, message: "Couldn't start the background service. Reload and try again." };
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource }));
    const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    if (!res.ok) return { ok: false, message: "Couldn't register this device for reminders. Try again." };
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't subscribe to push notifications. Try again." };
  }
}

/** True when this device has notifications allowed and an active push subscription. */
export async function devicePushActive(): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Show a notification through the service worker (works while the app is open). */
export async function showLocalNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  await reg.showNotification(title, { body, tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: "/app" } });
  return true;
}
