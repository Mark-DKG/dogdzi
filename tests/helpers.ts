import { applyPatch, emptySnapshot } from "../src/lib/domain/snapshot";
import type { Ctx, Patch, Snapshot } from "../src/lib/domain/types";

/** Deterministic context: fixed clock, sequential ids. */
export function makeCtx(nowIso: string, timezone = "Africa/Accra"): Ctx & { advance(mins: number): void; set(iso: string): void } {
  let n = 0;
  const ctx = {
    now: new Date(nowIso),
    timezone,
    id: () => {
      n++;
      return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    },
    advance(mins: number) {
      ctx.now = new Date(ctx.now.getTime() + mins * 60000);
    },
    set(iso: string) {
      ctx.now = new Date(iso);
    },
  };
  return ctx;
}

export function snap(timezone = "Africa/Accra", nowIso = "2026-11-02T08:00:00.000Z"): Snapshot {
  return emptySnapshot(timezone, nowIso);
}

/** Apply a list of patch-producing steps in order. */
export function run(s: Snapshot, ...steps: ((s: Snapshot) => Patch)[]): Snapshot {
  return steps.reduce((acc, step) => applyPatch(acc, step(acc)), s);
}
