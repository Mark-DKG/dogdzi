/**
 * Platform detection and capability checks, kept in one place so a future
 * Capacitor (Android/iOS) wrapper only needs changes here. The pure helpers
 * take their inputs as arguments so they can be unit-tested.
 */

export type MobileOS = "ios" | "android" | "other";
export type InstallMethod =
  | "installed" // already running as an installed app or native wrapper
  | "prompt" // the browser offered an install prompt we can trigger (Chrome, Edge, Samsung…)
  | "ios-safari" // Share → Add to Home Screen
  | "ios-other" // iOS browser other than Safari: use its Share menu, or open in Safari
  | "android-menu" // Android browser without a prompt: browser menu → Install / Add to Home screen
  | "desktop-menu" // desktop browser without a prompt: address-bar install icon or browser menu
  | "unsupported";

export function detectMobileOS(ua: string, maxTouchPoints = 0): MobileOS {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && maxTouchPoints > 1)) return "ios";
  return "other";
}

/** iOS Safari proper (not Chrome/Firefox/Edge/in-app browsers on iOS). */
export function isIOSSafariUA(ua: string): boolean {
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\/|fban|fbav|instagram|line\//i.test(ua);
}

export function installMethod(input: { ua: string; maxTouchPoints?: number; standalone: boolean; native: boolean; hasPrompt: boolean }): InstallMethod {
  if (input.native || input.standalone) return "installed";
  if (input.hasPrompt) return "prompt";
  const os = detectMobileOS(input.ua, input.maxTouchPoints);
  if (os === "ios") return isIOSSafariUA(input.ua) ? "ios-safari" : "ios-other";
  if (os === "android") return "android-menu";
  if (/firefox/i.test(input.ua) && !/android/i.test(input.ua)) return "unsupported";
  return "desktop-menu";
}

/* ───────────────────────────── runtime (browser) ───────────────────────────── */

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

/** True inside a Capacitor native shell (Android/iOS app). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Running as an installed PWA (standalone window) or inside the native shell. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    isNativeApp() ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function runtimeOS(): MobileOS {
  if (typeof navigator === "undefined") return "other";
  return detectMobileOS(navigator.userAgent, navigator.maxTouchPoints);
}

/** What the current environment can do. Web-only features are off inside a native wrapper. */
export const capabilities = {
  serviceWorker: () => typeof navigator !== "undefined" && "serviceWorker" in navigator && !isNativeApp(),
  /** Browser Web Push. A native build would use the platform push plugin instead (not implemented yet). */
  webPush: () => typeof window !== "undefined" && "PushManager" in window && "Notification" in window && !isNativeApp(),
  notifications: () => typeof window !== "undefined" && "Notification" in window && !isNativeApp(),
  install: () => typeof window !== "undefined" && !isNativeApp(),
};

/* ───────────────────────────── install prompt store ───────────────────────────── */

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Call once, as early as possible: browsers fire `beforeinstallprompt` only once per load. */
export function captureInstallPrompt() {
  if (typeof window === "undefined" || !capabilities.install()) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

export function onInstallChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function currentInstallMethod(): InstallMethod {
  if (typeof window === "undefined") return "unsupported";
  return installMethod({
    ua: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: isStandalone() || installedNow,
    native: isNativeApp(),
    hasPrompt: !!deferredPrompt,
  });
}

/** Show the browser's install dialog. Returns true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const e = deferredPrompt;
  deferredPrompt = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") installedNow = true;
  notify();
  return outcome === "accepted";
}
