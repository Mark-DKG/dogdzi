"use client";

import { useEffect } from "react";
import { captureInstallPrompt, isStandalone } from "@/lib/platform";

/** Height drop of the visual viewport that we treat as an on-screen keyboard. */
const KEYBOARD_THRESHOLD = 120;

/**
 * Runs once at startup:
 *  - captures the browser's install prompt (it only fires once per page load)
 *  - tracks the on-screen keyboard via the Visual Viewport API and exposes
 *    --vvh (visible height) and --kb (keyboard height) CSS variables plus
 *    <html data-keyboard="open">, so sheets and fixed bars stay usable
 *  - keeps focused fields visible while typing
 *  - marks standalone mode with <html data-standalone>
 */
export function PlatformBoot() {
  useEffect(() => {
    captureInstallPrompt();
    const root = document.documentElement;
    if (isStandalone()) root.dataset.standalone = "true";

    const vv = window.visualViewport;
    let raf = 0;
    // Tallest layout height seen at the current width. When Android shrinks the
    // layout for the keyboard (interactive-widget=resizes-content), the drop shows up here.
    let baseWidth = window.innerWidth;
    let baseHeight = window.innerHeight;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.innerWidth !== baseWidth) {
          baseWidth = window.innerWidth;
          baseHeight = window.innerHeight;
        } else if (window.innerHeight > baseHeight) baseHeight = window.innerHeight;
        const visible = vv ? vv.height : window.innerHeight;
        const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
        root.style.setProperty("--vvh", `${Math.round(visible)}px`);
        root.style.setProperty("--kb", `${kb > KEYBOARD_THRESHOLD ? Math.round(kb) : 0}px`);
        const editing = isEditable(document.activeElement);
        const layoutShrunk = baseHeight - window.innerHeight > KEYBOARD_THRESHOLD;
        if (kb > KEYBOARD_THRESHOLD || (editing && layoutShrunk)) root.dataset.keyboard = "open";
        else delete root.dataset.keyboard;
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!isEditable(el)) return;
      // Wait for the keyboard to finish opening, then bring the field into view.
      window.setTimeout(() => {
        if (document.activeElement === el) el?.scrollIntoView({ block: "center", behavior: "smooth" });
        update();
      }, 300);
    };
    const onFocusOut = () => window.setTimeout(update, 100);

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return null;
}

function isEditable(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type);
  return (el as HTMLElement).isContentEditable;
}
