import type { OccurrenceStatus, ReasonCode, Resolution } from "./types";

/** Neutral, non-judgemental reason labels. */
export const REASON_LABELS: Record<ReasonCode, string> = {
  forgot: "It slipped my mind",
  no_time: "Ran out of time",
  low_energy: "Low energy",
  unexpected_event: "Something came up",
  unclear_next_step: "Wasn't sure how to start",
  blocked: "Waiting on someone or something",
  changed_priorities: "Priorities changed",
  unwell: "Not feeling well",
  other: "Something else",
};

export const RESOLUTION_LABELS: Record<Resolution, string> = {
  completed_late: "Done later",
  rescheduled: "Rescheduled",
  recovery_plan: "Recovery plan",
  cancelled: "Cancelled",
  acknowledged: "Let go",
};

export const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  pending: "Open",
  done: "Done",
  missed: "Missed",
  skipped: "Skipped",
  rescheduled: "Moved",
  cancelled: "Cancelled",
};

/** Suggested first steps for a recovery plan, keyed by the reason given. */
export const RECOVERY_SUGGESTIONS: Record<ReasonCode, string[]> = {
  forgot: ["Pick a fixed time and turn on a firmer reminder", "Pair it with something you already do daily"],
  no_time: ["Shrink it to a 10-minute version", "Block the time in your calendar first"],
  low_energy: ["Do the smallest possible first step", "Move it to the time of day you have most energy"],
  unexpected_event: ["Choose a new date that's realistic", "Note what you need to restart"],
  unclear_next_step: ["Write down the very first physical step", "Break it into two smaller actions"],
  blocked: ["Message the person you're waiting on", "Find one part you can do without them"],
  changed_priorities: ["Decide if this still matters this month", "If it does, schedule one small step"],
  unwell: ["Rest first, then pick a gentle restart date", "Lower the target for the first week back"],
  other: ["Decide on one small next step", "Pick a restart date"],
};

/** Supportive message after a review is recorded. */
export function reviewAcknowledgement(outcome: Resolution): string {
  switch (outcome) {
    case "completed_late":
      return "Done is done. Nice recovery.";
    case "rescheduled":
      return "Moved. It's on your list for the new time.";
    case "recovery_plan":
      return "Recovery plan saved. One step at a time.";
    case "cancelled":
      return "Cancelled. It stays in your history for reference.";
    case "acknowledged":
      return "Noted. Tomorrow is a fresh start.";
  }
}
