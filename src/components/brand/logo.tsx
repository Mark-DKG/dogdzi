import Image from "next/image";
import { cn } from "@/lib/utils";

/*
 * Official Dogdzi artwork, used unaltered (aspect ratio preserved).
 *  - Lockup: supplied transparent cream logo (monogram + Dogdzi wordmark).
 *    Only for dark/forest backgrounds: cream on light would fail contrast.
 *  - LockupOnGreen: supplied full-background version, safe on any background.
 *  - Monogram: the DZD mark cropped from the supplied files.
 */

const LOCKUP = { src: "/brand/dogdzi-lockup.png", w: 1000, h: 451 };
const LOCKUP_GREEN = { src: "/brand/dogdzi-lockup-green.png", w: 800, h: 800 };
const MONOGRAM = { src: "/brand/dogdzi-monogram.png", w: 800, h: 266 };

export function Lockup({ width = 240, className, priority }: { width?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={LOCKUP.src}
      alt="Dogdzi"
      width={width}
      height={Math.round((width * LOCKUP.h) / LOCKUP.w)}
      priority={priority}
      className={cn("h-auto select-none", className)}
    />
  );
}

export function LockupOnGreen({ width = 200, className, priority }: { width?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src={LOCKUP_GREEN.src}
      alt="Dogdzi"
      width={width}
      height={width}
      priority={priority}
      className={cn("h-auto select-none rounded-2xl", className)}
    />
  );
}

/** Compact DZD mark on its brand tile, for navigation and small spaces. */
export function Monogram({ height = 28, className, tile = true }: { height?: number; className?: string; tile?: boolean }) {
  const width = Math.round((height * MONOGRAM.w) / MONOGRAM.h);
  const img = <Image src={MONOGRAM.src} alt="Dogdzi" width={width} height={height} className="h-auto select-none" />;
  if (!tile) return <span className={className}>{img}</span>;
  return <span className={cn("inline-flex items-center rounded-xl bg-forest-900 px-2.5 py-2", className)}>{img}</span>;
}

/** Tagline treatment from the brand: "GET IT DONE" with "By 9DEVs". */
export function Tagline({ className, byline = true }: { className?: string; byline?: boolean }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-brand", className)}>
      Get it done{byline && <span className="ml-3 font-medium normal-case tracking-normal opacity-80">By 9DEVs</span>}
    </p>
  );
}
