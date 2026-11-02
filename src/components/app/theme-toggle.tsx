"use client";

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/icons";
import { applyTheme, onThemeChange, readThemePref, resolveTheme, type Theme, type ThemePref } from "@/lib/theme";
import { cn } from "@/lib/utils";

function useTheme() {
  const [pref, setPref] = useState<ThemePref>("system");
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => {
      const p = readThemePref();
      setPref(p);
      setTheme(resolveTheme(p));
    };
    sync();
    const off = onThemeChange(sync);
    // Follow the OS while the choice is "system".
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readThemePref() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSystem);
    return () => {
      off();
      mq.removeEventListener("change", onSystem);
    };
  }, []);
  return { pref, theme };
}

/** One-tap light/dark switch for the app menu. */
export function ThemeToggle({ variant = "menu", className }: { variant?: "menu" | "bar"; className?: string }) {
  const { theme } = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        variant === "menu"
          ? "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-forest-100 transition-colors hover:bg-forest-800 hover:text-cream-100"
          : "flex h-11 w-11 items-center justify-center rounded-xl text-forest-100 hover:bg-forest-800 hover:text-cream-100",
        className,
      )}
    >
      {theme === "dark" ? <IconSun size={variant === "menu" ? 19 : 20} /> : <IconMoon size={variant === "menu" ? 19 : 20} />}
      {variant === "menu" && <span className="flex-1 text-left">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

/** Light / Dark / System choice for Settings. */
export function ThemeChooser() {
  const { pref } = useTheme();
  const options: { value: ThemePref; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Match device" },
  ];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-fg">Theme</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              pref === o.value ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-fg hover:bg-surface-2",
            )}
          >
            <input type="radio" name="theme" value={o.value} checked={pref === o.value} onChange={() => applyTheme(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
