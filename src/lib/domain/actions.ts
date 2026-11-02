/**
 * Pure state transitions. Every function takes the current snapshot and a
 * context (clock + id source) and returns a Patch. Nothing here performs I/O.
 *
 * Invariants enforced here (and again in the database):
 *  - occurrences are never deleted; they change status
 *  - a missed/skipped occurrence never goes back to "pending"
 *  - history events and accountability responses are append-only
 */
import { addDays, isValidHHMM, isValidISODate, toISODate, zonedToUtc } from "./dates";
import { normalizeFirstName } from "./names";
import { deterministicUuid } from "./ids";
import { expandRecurrence } from "./recurrence";
import { applyPatch, emptyPatch, mergePatches, missingAreaCategories } from "./snapshot";
import type {
  AccountabilityResponse,
  AccountabilityTrigger,
  Action,
  ActionKind,
  Category,
  Ctx,
  Goal,
  GoalKind,
  GoalStatus,
  HHMM,
  HistoryEvent,
  HistoryEventType,
  ISODate,
  LifeArea,
  Milestone,
  Occurrence,
  OccurrenceSource,
  Patch,
  Preferences,
  Priority,
  ReasonCode,
  Recurrence,
  RecoveryPlan,
  RecoveryStatus,
  Resolution,
  Snapshot,
  UUID,
} from "./types";

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Minutes after a timed action's due time before it counts as missed. */
export const MISSED_GRACE_MIN = 120;
/** How far back a routine is materialised when the app hasn't been opened. */
export const BACKFILL_DAYS = 7;
/** How far ahead recurring occurrences are materialised. */
export const HORIZON_DAYS = 14;

const iso = (ctx: Ctx) => ctx.now.toISOString();
const today = (ctx: Ctx) => toISODate(ctx.now, ctx.timezone);

function event(ctx: Ctx, actionId: UUID, occurrenceId: UUID | null, type: HistoryEventType, data: Record<string, unknown> = {}): HistoryEvent {
  return { id: ctx.id(), actionId, occurrenceId, type, at: iso(ctx), data };
}

function findAction(s: Snapshot, id: UUID): Action {
  const a = s.actions.find((x) => x.id === id);
  if (!a) throw new DomainError("not_found", "That action no longer exists.");
  return a;
}
function findOccurrence(s: Snapshot, id: UUID): Occurrence {
  const o = s.occurrences.find((x) => x.id === id);
  if (!o) throw new DomainError("not_found", "That scheduled action no longer exists.");
  return o;
}

function newOccurrence(ctx: Ctx, action: Action, date: ISODate, time: HHMM | null, source: OccurrenceSource, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    id: source === "recurrence" ? deterministicUuid(`${action.id}:${date}`) : ctx.id(),
    actionId: action.id,
    date,
    time,
    status: "pending",
    resolution: null,
    completedAt: null,
    source,
    rescheduledFromId: null,
    rescheduledToId: null,
    createdAt: iso(ctx),
    updatedAt: iso(ctx),
    ...extra,
  };
}

/** UTC instant after which a pending occurrence counts as missed. */
export function missedAfter(o: Pick<Occurrence, "date" | "time">, timezone: string, durationMin?: number | null): Date {
  if (o.time) {
    const due = zonedToUtc(o.date, o.time, timezone);
    return new Date(due.getTime() + Math.max(MISSED_GRACE_MIN, durationMin ?? 0) * 60000);
  }
  return zonedToUtc(addDays(o.date, 1), "00:00", timezone);
}

/* ───────────────────────────── Actions ───────────────────────────── */

export interface ActionInput {
  title: string;
  notes?: string | null;
  categoryId?: UUID | null;
  kind?: ActionKind;
  priority?: Priority;
  startDate: ISODate;
  time?: HHMM | null;
  durationMin?: number | null;
  recurrence?: Recurrence | null;
  reminderOffsets?: number[];
  remindersEnabled?: boolean;
  goalId?: UUID | null;
  milestoneId?: UUID | null;
}

export function validateActionInput(input: Partial<ActionInput>, partial = false): void {
  if (!partial || input.title !== undefined) {
    const t = (input.title ?? "").trim();
    if (!t) throw new DomainError("invalid", "Give the action a short title.");
    if (t.length > 140) throw new DomainError("invalid", "Keep the title under 140 characters.");
  }
  if (input.notes && input.notes.length > 2000) throw new DomainError("invalid", "Notes are limited to 2,000 characters.");
  if ((!partial || input.startDate !== undefined) && !isValidISODate(input.startDate ?? "")) throw new DomainError("invalid", "Choose a valid date.");
  if (input.time && !isValidHHMM(input.time)) throw new DomainError("invalid", "Choose a valid time.");
  if (input.durationMin != null && (input.durationMin < 1 || input.durationMin > 24 * 60)) throw new DomainError("invalid", "Duration must be between 1 minute and 24 hours.");
  if (input.recurrence) {
    const r = input.recurrence;
    if (!["daily", "weekly", "monthly"].includes(r.freq)) throw new DomainError("invalid", "Unsupported repeat rule.");
    if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 52) throw new DomainError("invalid", "Repeat interval must be between 1 and 52.");
    if (r.byWeekday && r.byWeekday.some((d) => d < 0 || d > 6)) throw new DomainError("invalid", "Invalid weekday.");
    if (r.freq === "weekly" && r.byWeekday && r.byWeekday.length === 0) throw new DomainError("invalid", "Pick at least one day of the week.");
    if (r.until && !isValidISODate(r.until)) throw new DomainError("invalid", "Choose a valid end date.");
    if (r.until && input.startDate && r.until < input.startDate) throw new DomainError("invalid", "The repeat end date is before the start date.");
  }
  if (input.reminderOffsets && input.reminderOffsets.some((m) => !Number.isFinite(m) || m < 0 || m > 7 * 24 * 60)) {
    throw new DomainError("invalid", "Reminder times must be within a week before the action.");
  }
}

export function createAction(s: Snapshot, input: ActionInput, ctx: Ctx): Patch {
  validateActionInput(input);
  if (input.categoryId && !s.categories.some((c) => c.id === input.categoryId)) throw new DomainError("invalid", "Unknown category.");
  if (input.goalId && !s.goals.some((g) => g.id === input.goalId)) throw new DomainError("invalid", "Unknown goal.");
  const now = iso(ctx);
  const recurrence = input.recurrence ?? null;
  const action: Action = {
    id: ctx.id(),
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    categoryId: input.categoryId ?? null,
    kind: input.kind ?? (recurrence ? "routine" : "task"),
    priority: input.priority ?? "normal",
    startDate: input.startDate,
    time: input.time || null,
    durationMin: input.durationMin ?? null,
    recurrence,
    reminderOffsets: dedupeOffsets(input.reminderOffsets ?? []),
    remindersEnabled: input.remindersEnabled ?? true,
    goalId: input.goalId ?? null,
    milestoneId: input.milestoneId ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const patch: Patch = {
    upsert: { actions: [action] },
    append: { events: [event(ctx, action.id, null, "created", { kind: action.kind, recurring: !!recurrence })] },
  };
  if (!recurrence) {
    patch.upsert.occurrences = [newOccurrence(ctx, action, action.startDate, action.time, "single")];
    return patch;
  }
  const next = { ...s, actions: s.actions.concat(action) };
  return mergePatches(patch, materialize(next, ctx));
}

function dedupeOffsets(o: number[]): number[] {
  return Array.from(new Set(o.map((m) => Math.round(m)))).sort((a, b) => b - a);
}

const EDITABLE_FIELDS = [
  "title",
  "notes",
  "categoryId",
  "priority",
  "startDate",
  "time",
  "durationMin",
  "recurrence",
  "reminderOffsets",
  "remindersEnabled",
  "goalId",
  "milestoneId",
] as const;

export function updateAction(s: Snapshot, id: UUID, changes: Partial<ActionInput>, ctx: Ctx): Patch {
  const a = findAction(s, id);
  if (a.status === "cancelled") throw new DomainError("invalid_state", "This action was cancelled. Create a new one instead.");
  validateActionInput({ ...changes, startDate: changes.startDate ?? a.startDate }, true);
  if (changes.recurrence !== undefined && !!changes.recurrence !== !!a.recurrence) {
    throw new DomainError("invalid", "A one-off action can't be turned into a routine (or back). Create a new action instead.");
  }
  const changed: string[] = [];
  const next: Action = { ...a, updatedAt: iso(ctx) };
  for (const f of EDITABLE_FIELDS) {
    if (changes[f] === undefined) continue;
    let v: unknown = changes[f];
    if (f === "title") v = String(v).trim();
    if (f === "notes") v = (v as string | null)?.trim() || null;
    if (f === "time") v = v || null;
    if (f === "reminderOffsets") v = dedupeOffsets(v as number[]);
    if (JSON.stringify(v) !== JSON.stringify(a[f as keyof Action])) {
      (next as unknown as Record<string, unknown>)[f] = v;
      changed.push(f);
    }
  }
  if (changed.length === 0) return emptyPatch();

  const t = today(ctx);
  const occs: Occurrence[] = [];
  const pendingFuture = s.occurrences.filter((o) => o.actionId === id && o.status === "pending" && o.date >= t);

  if (!a.recurrence) {
    // One-off: move the open occurrence along with the plan.
    for (const o of pendingFuture.length ? pendingFuture : s.occurrences.filter((o) => o.actionId === id && o.status === "pending")) {
      if (changed.includes("startDate") || changed.includes("time")) {
        occs.push({ ...o, date: next.startDate, time: next.time, updatedAt: iso(ctx) });
      }
    }
  } else {
    const ruleChanged = changed.includes("recurrence") || changed.includes("startDate");
    const allowed = ruleChanged ? new Set(expandRecurrence(next.recurrence!, next.startDate, t, addDays(t, HORIZON_DAYS))) : null;
    for (const o of pendingFuture) {
      if (o.source !== "recurrence") continue;
      if (allowed && !allowed.has(o.date)) {
        occs.push({ ...o, status: "cancelled", updatedAt: iso(ctx) });
      } else if (changed.includes("time")) {
        occs.push({ ...o, time: next.time, updatedAt: iso(ctx) });
      }
    }
    if (allowed) {
      // Revive future days that were dropped by an earlier schedule change.
      for (const o of s.occurrences) {
        if (o.actionId === id && o.source === "recurrence" && o.status === "cancelled" && o.resolution === null && o.date > t && allowed.has(o.date)) {
          occs.push({ ...o, status: "pending", time: next.time, updatedAt: iso(ctx) });
        }
      }
    }
  }

  const patch: Patch = {
    upsert: { actions: [next], ...(occs.length ? { occurrences: occs } : {}) },
    append: { events: [event(ctx, id, null, "edited", { fields: changed })] },
  };
  if (a.recurrence) {
    const after = applyLocal(s, patch);
    return mergePatches(patch, materialize(after, ctx));
  }
  return patch;
}

/** Stop an action entirely. Open occurrences become "cancelled"; history stays. */
export function cancelAction(s: Snapshot, id: UUID, ctx: Ctx): Patch {
  const a = findAction(s, id);
  if (a.status === "cancelled") return emptyPatch();
  const open = s.occurrences.filter((o) => o.actionId === id && o.status === "pending");
  return {
    upsert: {
      actions: [{ ...a, status: "cancelled", updatedAt: iso(ctx) }],
      occurrences: open.map((o) => ({ ...o, status: "cancelled" as const, updatedAt: iso(ctx) })),
    },
    append: { events: [event(ctx, id, null, "cancelled", { scope: "action", openOccurrences: open.length })] },
  };
}

/* ─────────────────────────── Occurrences ─────────────────────────── */

export function completeOccurrence(s: Snapshot, occurrenceId: UUID, ctx: Ctx): Patch {
  const o = findOccurrence(s, occurrenceId);
  if (o.status === "done") return emptyPatch();
  if (o.status === "missed" && o.resolution === null) {
    return respond(s, occurrenceId, { trigger: "missed", reasonCode: "other", note: null, outcome: "complete_now" }, ctx);
  }
  if (o.status !== "pending") throw new DomainError("invalid_state", "Only open actions can be completed.");
  return {
    upsert: { occurrences: [{ ...o, status: "done", completedAt: iso(ctx), updatedAt: iso(ctx) }] },
    append: { events: [event(ctx, o.actionId, o.id, "completed", { date: o.date })] },
  };
}

/** Undo a completion. A late completion returns to "missed" (needs review), never to "pending". */
export function reopenOccurrence(s: Snapshot, occurrenceId: UUID, ctx: Ctx): Patch {
  const o = findOccurrence(s, occurrenceId);
  if (o.status !== "done") throw new DomainError("invalid_state", "Only completed actions can be reopened.");
  const late = o.resolution === "completed_late";
  const overdue = !late && ctx.now >= missedAfter(o, ctx.timezone, findAction(s, o.actionId).durationMin);
  const status = late || overdue ? "missed" : "pending";
  return {
    upsert: { occurrences: [{ ...o, status, resolution: null, completedAt: null, updatedAt: iso(ctx) }] },
    append: { events: [event(ctx, o.actionId, o.id, "reopened", { to: status })] },
  };
}

/** Move an open occurrence to another day/time. The original stays in history as "rescheduled". */
export function rescheduleOccurrence(s: Snapshot, occurrenceId: UUID, date: ISODate, time: HHMM | null, ctx: Ctx): Patch {
  const o = findOccurrence(s, occurrenceId);
  if (o.status !== "pending") throw new DomainError("invalid_state", "Only open actions can be rescheduled this way.");
  if (!isValidISODate(date) || (time && !isValidHHMM(time))) throw new DomainError("invalid", "Choose a valid date and time.");
  if (date < today(ctx)) throw new DomainError("invalid", "Pick today or a later date.");
  const a = findAction(s, o.actionId);
  const moved = newOccurrence(ctx, a, date, time, "reschedule", { rescheduledFromId: o.id });
  return {
    upsert: { occurrences: [{ ...o, status: "rescheduled", rescheduledToId: moved.id, updatedAt: iso(ctx) }, moved] },
    append: { events: [event(ctx, a.id, o.id, "rescheduled", { from: o.date, to: date, newOccurrenceId: moved.id })] },
  };
}

export type ResponseOutcome = "complete_now" | "reschedule" | "recovery_plan" | "cancel" | "acknowledge";

export interface RespondInput {
  trigger: AccountabilityTrigger;
  reasonCode: ReasonCode;
  note: string | null;
  outcome: ResponseOutcome;
  reschedule?: { date: ISODate; time: HHMM | null };
  recovery?: { title: string; steps: string[]; restartDate: ISODate | null; restartTime?: HHMM | null };
}

const OUTCOME_TO_RESOLUTION: Record<ResponseOutcome, Resolution> = {
  complete_now: "completed_late",
  reschedule: "rescheduled",
  recovery_plan: "recovery_plan",
  cancel: "cancelled",
  acknowledge: "acknowledged",
};

/**
 * The accountability step: record why something was missed or skipped and
 * what happens next. Works for missed occurrences awaiting review and for
 * open occurrences the user chooses to skip.
 */
export function respond(s: Snapshot, occurrenceId: UUID, input: RespondInput, ctx: Ctx): Patch {
  const o = findOccurrence(s, occurrenceId);
  const a = findAction(s, o.actionId);
  if (input.trigger === "missed" && !(o.status === "missed" && o.resolution === null)) {
    throw new DomainError("invalid_state", "This action has already been reviewed.");
  }
  if (input.trigger === "skipped" && o.status !== "pending") {
    throw new DomainError("invalid_state", "Only open actions can be skipped.");
  }
  if (input.trigger === "skipped" && input.outcome === "complete_now") {
    throw new DomainError("invalid", "A skipped action can't be completed at the same time.");
  }
  if (input.note && input.note.length > 1000) throw new DomainError("invalid", "Keep the note under 1,000 characters.");

  const now = iso(ctx);
  const resolution = OUTCOME_TO_RESOLUTION[input.outcome];
  const response: AccountabilityResponse = {
    id: ctx.id(),
    actionId: a.id,
    occurrenceId: o.id,
    trigger: input.trigger,
    reasonCode: input.reasonCode,
    note: input.note?.trim() || null,
    outcome: resolution,
    createdAt: now,
  };
  const baseStatus = input.trigger === "skipped" ? "skipped" : "missed";
  let updated: Occurrence = { ...o, status: baseStatus, resolution, updatedAt: now };
  const occurrences: Occurrence[] = [];
  const actions: Action[] = [];
  const recoveryPlans: RecoveryPlan[] = [];
  const events: HistoryEvent[] = [];
  if (input.trigger === "skipped") events.push(event(ctx, a.id, o.id, "skipped", { date: o.date }));
  events.push(event(ctx, a.id, o.id, "reason_recorded", { reasonCode: input.reasonCode, responseId: response.id }));

  switch (input.outcome) {
    case "complete_now":
      updated = { ...updated, status: "done", completedAt: now };
      events.push(event(ctx, a.id, o.id, "completed_late", { date: o.date }));
      break;
    case "reschedule": {
      const r = input.reschedule;
      if (!r || !isValidISODate(r.date) || (r.time && !isValidHHMM(r.time))) throw new DomainError("invalid", "Choose when you'll do it instead.");
      if (r.date < today(ctx)) throw new DomainError("invalid", "Pick today or a later date.");
      const moved = newOccurrence(ctx, a, r.date, r.time, "reschedule", { rescheduledFromId: o.id });
      updated = { ...updated, rescheduledToId: moved.id };
      occurrences.push(moved);
      events.push(event(ctx, a.id, o.id, "rescheduled", { from: o.date, to: r.date, newOccurrenceId: moved.id }));
      break;
    }
    case "recovery_plan": {
      const rc = input.recovery;
      const steps = (rc?.steps ?? []).map((t) => t.trim()).filter(Boolean);
      if (!rc || steps.length === 0) throw new DomainError("invalid", "Add at least one recovery step.");
      if (steps.length > 12) throw new DomainError("invalid", "Keep recovery plans to 12 steps or fewer.");
      if (rc.restartDate && (!isValidISODate(rc.restartDate) || rc.restartDate < today(ctx))) throw new DomainError("invalid", "Pick a restart date from today onwards.");
      let restartId: UUID | null = null;
      if (rc.restartDate) {
        const restart = newOccurrence(ctx, a, rc.restartDate, rc.restartTime ?? a.time, "recovery", { rescheduledFromId: o.id });
        restartId = restart.id;
        updated = { ...updated, rescheduledToId: restart.id };
        occurrences.push(restart);
      }
      const plan: RecoveryPlan = {
        id: ctx.id(),
        actionId: a.id,
        occurrenceId: o.id,
        responseId: response.id,
        title: (rc.title || `Get back on track: ${a.title}`).trim().slice(0, 140),
        steps: steps.map((text) => ({ id: ctx.id(), text: text.slice(0, 200), done: false })),
        restartDate: rc.restartDate,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      recoveryPlans.push(plan);
      events.push(event(ctx, a.id, o.id, "recovery_plan_created", { planId: plan.id, steps: plan.steps.length, restartOccurrenceId: restartId }));
      break;
    }
    case "cancel":
      events.push(event(ctx, a.id, o.id, "cancelled", { scope: a.recurrence ? "occurrence" : "action" }));
      if (!a.recurrence) {
        actions.push({ ...a, status: "cancelled", updatedAt: now });
        for (const other of s.occurrences) {
          if (other.actionId === a.id && other.id !== o.id && other.status === "pending") {
            occurrences.push({ ...other, status: "cancelled", updatedAt: now });
          }
        }
      }
      break;
    case "acknowledge":
      events.push(event(ctx, a.id, o.id, "acknowledged", {}));
      break;
  }
  occurrences.unshift(updated);
  return {
    upsert: {
      occurrences,
      ...(actions.length ? { actions } : {}),
      ...(recoveryPlans.length ? { recoveryPlans } : {}),
    },
    append: { events, responses: [response] },
  };
}

/** Acknowledge several missed routine days at once, with one shared reason. */
export function acknowledgeMany(s: Snapshot, occurrenceIds: UUID[], reasonCode: ReasonCode, ctx: Ctx): Patch {
  let cur = s;
  const parts: Patch[] = [];
  for (const id of occurrenceIds) {
    const p = respond(cur, id, { trigger: "missed", reasonCode, note: null, outcome: "acknowledge" }, ctx);
    parts.push(p);
    cur = applyLocal(cur, p);
  }
  return mergePatches(...parts);
}

/* ─────────────────────────── Maintenance ─────────────────────────── */

/** Create pending occurrences for active routines over [today-backfill, today+horizon]. */
export function materialize(s: Snapshot, ctx: Ctx, opts: { horizonDays?: number; backfillDays?: number } = {}): Patch {
  const t = today(ctx);
  const to = addDays(t, opts.horizonDays ?? HORIZON_DAYS);
  const existing = new Set(s.occurrences.map((o) => o.id));
  const out: Occurrence[] = [];
  for (const a of s.actions) {
    if (a.status !== "active" || !a.recurrence) continue;
    const created = toISODate(new Date(a.createdAt), ctx.timezone);
    let from = addDays(t, -(opts.backfillDays ?? BACKFILL_DAYS));
    if (a.startDate > from) from = a.startDate;
    if (created > from) from = created;
    for (const d of expandRecurrence(a.recurrence, a.startDate, from, to)) {
      const occ = newOccurrence(ctx, a, d, a.time, "recurrence");
      if (!existing.has(occ.id)) {
        existing.add(occ.id);
        out.push(occ);
      }
    }
  }
  return out.length ? { upsert: { occurrences: out }, append: {} } : emptyPatch();
}

/** Pending occurrences whose time has passed become "missed" and enter the review queue. */
export function markMissed(s: Snapshot, ctx: Ctx): Patch {
  const byId = new Map(s.actions.map((a) => [a.id, a]));
  const occs: Occurrence[] = [];
  const events: HistoryEvent[] = [];
  for (const o of s.occurrences) {
    if (o.status !== "pending") continue;
    const a = byId.get(o.actionId);
    if (!a || a.status !== "active") continue;
    if (ctx.now >= missedAfter(o, ctx.timezone, a.durationMin)) {
      occs.push({ ...o, status: "missed", resolution: null, updatedAt: iso(ctx) });
      events.push(event(ctx, a.id, o.id, "missed", { date: o.date }));
    }
  }
  return occs.length ? { upsert: { occurrences: occs }, append: { events } } : emptyPatch();
}

export function maintenance(s: Snapshot, ctx: Ctx): Patch {
  const m = materialize(s, ctx);
  return mergePatches(m, markMissed(applyLocal(s, m), ctx));
}

/* ───────────────────────── Goals & roadmaps ───────────────────────── */

export interface GoalInput {
  title: string;
  description?: string | null;
  kind?: GoalKind;
  categoryId?: UUID | null;
  targetDate?: ISODate | null;
  milestones?: { title: string; targetDate?: ISODate | null }[];
}

export function createGoal(s: Snapshot, input: GoalInput, ctx: Ctx): Patch {
  const title = input.title.trim();
  if (!title) throw new DomainError("invalid", "Give the goal a name.");
  if (title.length > 140) throw new DomainError("invalid", "Keep the name under 140 characters.");
  if (input.targetDate && !isValidISODate(input.targetDate)) throw new DomainError("invalid", "Choose a valid target date.");
  const now = iso(ctx);
  const goal: Goal = {
    id: ctx.id(),
    title,
    description: input.description?.trim() || null,
    kind: input.kind ?? "goal",
    categoryId: input.categoryId ?? null,
    targetDate: input.targetDate ?? null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  const milestones = (input.milestones ?? [])
    .filter((m) => m.title.trim())
    .map((m, i) => newMilestone(ctx, goal.id, m.title, m.targetDate ?? null, i));
  return { upsert: { goals: [goal], ...(milestones.length ? { milestones } : {}) }, append: {} };
}

function newMilestone(ctx: Ctx, goalId: UUID, title: string, targetDate: ISODate | null, position: number): Milestone {
  const t = title.trim();
  if (!t) throw new DomainError("invalid", "Give the milestone a name.");
  if (targetDate && !isValidISODate(targetDate)) throw new DomainError("invalid", "Choose a valid milestone date.");
  return { id: ctx.id(), goalId, title: t.slice(0, 140), targetDate, position, status: "todo", completedAt: null, createdAt: iso(ctx), updatedAt: iso(ctx) };
}

export function updateGoal(s: Snapshot, id: UUID, changes: Partial<Pick<Goal, "title" | "description" | "targetDate" | "status" | "categoryId" | "kind">>, ctx: Ctx): Patch {
  const g = s.goals.find((x) => x.id === id);
  if (!g) throw new DomainError("not_found", "That goal no longer exists.");
  if (changes.title !== undefined && !changes.title.trim()) throw new DomainError("invalid", "Give the goal a name.");
  const allowed: GoalStatus[] = ["active", "paused", "completed", "archived"];
  if (changes.status && !allowed.includes(changes.status)) throw new DomainError("invalid", "Unknown status.");
  return { upsert: { goals: [{ ...g, ...changes, title: (changes.title ?? g.title).trim(), updatedAt: iso(ctx) }] }, append: {} };
}

export function addMilestone(s: Snapshot, goalId: UUID, title: string, targetDate: ISODate | null, ctx: Ctx): Patch {
  if (!s.goals.some((g) => g.id === goalId)) throw new DomainError("not_found", "That goal no longer exists.");
  const position = s.milestones.filter((m) => m.goalId === goalId).reduce((mx, m) => Math.max(mx, m.position + 1), 0);
  return { upsert: { milestones: [newMilestone(ctx, goalId, title, targetDate, position)] }, append: {} };
}

export function setMilestoneStatus(s: Snapshot, id: UUID, done: boolean, ctx: Ctx): Patch {
  const m = s.milestones.find((x) => x.id === id);
  if (!m) throw new DomainError("not_found", "That milestone no longer exists.");
  return {
    upsert: { milestones: [{ ...m, status: done ? "done" : "todo", completedAt: done ? iso(ctx) : null, updatedAt: iso(ctx) }] },
    append: {},
  };
}

export function moveMilestone(s: Snapshot, id: UUID, dir: -1 | 1, ctx: Ctx): Patch {
  const m = s.milestones.find((x) => x.id === id);
  if (!m) throw new DomainError("not_found", "That milestone no longer exists.");
  const list = s.milestones.filter((x) => x.goalId === m.goalId).sort((a, b) => a.position - b.position);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return emptyPatch();
  const other = list[j];
  return {
    upsert: {
      milestones: [
        { ...m, position: other.position, updatedAt: iso(ctx) },
        { ...other, position: m.position, updatedAt: iso(ctx) },
      ],
    },
    append: {},
  };
}

/* ─────────────────────────── Recovery plans ─────────────────────────── */

export function toggleRecoveryStep(s: Snapshot, planId: UUID, stepId: UUID, ctx: Ctx): Patch {
  const p = s.recoveryPlans.find((x) => x.id === planId);
  if (!p) throw new DomainError("not_found", "That recovery plan no longer exists.");
  const steps = p.steps.map((st) => (st.id === stepId ? { ...st, done: !st.done } : st));
  return { upsert: { recoveryPlans: [{ ...p, steps, updatedAt: iso(ctx) }] }, append: {} };
}

export function setRecoveryStatus(s: Snapshot, planId: UUID, status: RecoveryStatus, ctx: Ctx): Patch {
  const p = s.recoveryPlans.find((x) => x.id === planId);
  if (!p) throw new DomainError("not_found", "That recovery plan no longer exists.");
  if (p.status === status) return emptyPatch();
  const patch: Patch = { upsert: { recoveryPlans: [{ ...p, status, updatedAt: iso(ctx) }] }, append: {} };
  if (status === "completed") patch.append.events = [event(ctx, p.actionId, p.occurrenceId, "recovery_plan_completed", { planId })];
  return patch;
}

/* ─────────────────────── Categories & preferences ─────────────────────── */

export function addCategory(s: Snapshot, name: string, area: LifeArea, color: string, ctx: Ctx): Patch {
  const n = name.trim();
  if (!n) throw new DomainError("invalid", "Give the category a name.");
  if (n.length > 40) throw new DomainError("invalid", "Keep category names under 40 characters.");
  if (s.categories.some((c) => !c.archived && c.name.toLowerCase() === n.toLowerCase())) throw new DomainError("invalid", "You already have a category with that name.");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new DomainError("invalid", "Invalid colour.");
  const cat: Category = { id: ctx.id(), name: n, area, color, position: s.categories.length, archived: false, createdAt: iso(ctx), updatedAt: iso(ctx) };
  return { upsert: { categories: [cat] }, append: {} };
}

export function updatePreferences(s: Snapshot, changes: Partial<Preferences>, ctx: Ctx): Patch {
  if (changes.quietStart && !isValidHHMM(changes.quietStart)) throw new DomainError("invalid", "Invalid quiet-hours start.");
  if (changes.quietEnd && !isValidHHMM(changes.quietEnd)) throw new DomainError("invalid", "Invalid quiet-hours end.");
  if (changes.maxNotificationsPerDay !== undefined && (changes.maxNotificationsPerDay < 1 || changes.maxNotificationsPerDay > 50)) {
    throw new DomainError("invalid", "Daily notification limit must be between 1 and 50.");
  }
  if (changes.firstName !== undefined) changes = { ...changes, firstName: normalizeFirstName(changes.firstName) };
  const patch: Patch = { upsert: {}, append: {}, preferences: { ...changes, updatedAt: iso(ctx) } };
  if (changes.lifeAreas) {
    const cats = missingAreaCategories(s, changes.lifeAreas, iso(ctx), ctx.id);
    if (cats.length) patch.upsert.categories = cats;
  }
  return patch;
}

/* ─────────────────────────────── helpers ─────────────────────────────── */

function applyLocal(s: Snapshot, p: Patch): Snapshot {
  return applyPatch(s, p);
}

/** Missed or skipped occurrences that still need a decision. */
export function reviewQueue(s: Snapshot): Occurrence[] {
  return s.occurrences
    .filter((o) => o.status === "missed" && o.resolution === null)
    .sort((a, b) => (a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date)));
}
