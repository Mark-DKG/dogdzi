import type { DataMode, Snapshot, UUID } from "./types";

/**
 * What a guest can do before creating an account. Guest data lives only in
 * this browser and is never backed up or synced.
 */
export const GUEST_LIMITS = {
  maxActiveActions: 10,
  maxGoals: 1,
  maxMilestonesPerGoal: 3,
  historyDays: 7,
} as const;

export type Capability =
  | "create_action"
  | "recurrence"
  | "create_goal"
  | "add_milestone"
  | "recovery_plan"
  | "full_history"
  | "insights"
  | "sync"
  | "push";

export type CapabilityResult = { ok: true } | { ok: false; reason: string };

/** Actions that still have something open (or are active routines). */
export function activeActionCount(s: Snapshot): number {
  const open = new Set(s.occurrences.filter((o) => o.status === "pending" || (o.status === "missed" && o.resolution === null)).map((o) => o.actionId));
  return s.actions.filter((a) => a.status === "active" && (a.recurrence || open.has(a.id))).length;
}

export function checkCapability(mode: DataMode, s: Snapshot, cap: Capability, ref?: { goalId?: UUID }): CapabilityResult {
  if (mode === "account") return { ok: true };
  switch (cap) {
    case "create_action":
      return activeActionCount(s) < GUEST_LIMITS.maxActiveActions
        ? { ok: true }
        : { ok: false, reason: `Guests can keep up to ${GUEST_LIMITS.maxActiveActions} active actions. Finish or cancel one, or create a free account for more.` };
    case "create_goal":
      return s.goals.filter((g) => g.status !== "archived").length < GUEST_LIMITS.maxGoals
        ? { ok: true }
        : { ok: false, reason: `Guests can track ${GUEST_LIMITS.maxGoals} goal. Create an account to plan more goals and roadmaps.` };
    case "add_milestone": {
      const n = s.milestones.filter((m) => m.goalId === ref?.goalId).length;
      return n < GUEST_LIMITS.maxMilestonesPerGoal
        ? { ok: true }
        : { ok: false, reason: `Guest roadmaps are limited to ${GUEST_LIMITS.maxMilestonesPerGoal} milestones. Create an account for full roadmaps.` };
    }
    case "recurrence":
      return { ok: false, reason: "Recurring routines and habits are available with a free account." };
    case "recovery_plan":
      return { ok: false, reason: "Recovery plans are available with a free account." };
    case "full_history":
      return { ok: false, reason: `Guests see the last ${GUEST_LIMITS.historyDays} days of history. Create an account to keep your full record.` };
    case "insights":
      return { ok: false, reason: "Progress insights are available with a free account." };
    case "sync":
      return { ok: false, reason: "Your guest data stays on this device only. Create an account to back it up and sync across devices." };
    case "push":
      return { ok: false, reason: "Background push reminders need an account. While Dogdzi is open, guests still get in-app reminders." };
  }
}
