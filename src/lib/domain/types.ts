/**
 * Dogdzi domain model.
 *
 * An Action is the commitment ("Gym session", "Pay rent"). Each time it is
 * due produces an Occurrence. Status lives on occurrences so a recurring
 * routine keeps a truthful record of every day. History events and
 * accountability responses are append-only: nothing that happened is ever
 * silently removed.
 */

export type UUID = string;
/** Calendar date in the user's time zone, `YYYY-MM-DD`. */
export type ISODate = string;
/** Wall-clock time, `HH:mm` (24h). */
export type HHMM = string;
/** ISO-8601 instant. */
export type Timestamp = string;

export const LIFE_AREAS = [
  "personal",
  "work",
  "education",
  "health",
  "home",
  "finance",
  "social",
  "custom",
] as const;
export type LifeArea = (typeof LIFE_AREAS)[number];

export interface Category {
  id: UUID;
  name: string;
  area: LifeArea;
  color: string;
  position: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export interface Recurrence {
  freq: RecurrenceFreq;
  /** Every N days / weeks / months / years. */
  interval: number;
  /** Weekly only: 0 = Sunday … 6 = Saturday. */
  byWeekday?: number[];
  until?: ISODate | null;
}

export type ActionKind = "task" | "routine" | "habit";
export type Priority = "low" | "normal" | "high";
export type ActionStatus = "active" | "cancelled";

export interface Action {
  id: UUID;
  title: string;
  notes: string | null;
  categoryId: UUID | null;
  kind: ActionKind;
  priority: Priority;
  startDate: ISODate;
  time: HHMM | null;
  durationMin: number | null;
  recurrence: Recurrence | null;
  /** Minutes before the due time to remind. Empty = use style defaults only. */
  reminderOffsets: number[];
  remindersEnabled: boolean;
  goalId: UUID | null;
  milestoneId: UUID | null;
  status: ActionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OccurrenceStatus = "pending" | "done" | "missed" | "skipped" | "rescheduled" | "cancelled";
export type OccurrenceSource = "single" | "recurrence" | "reschedule" | "recovery";

/** How a missed or skipped occurrence was dealt with. `null` = still needs review. */
export type Resolution = "completed_late" | "rescheduled" | "recovery_plan" | "cancelled" | "acknowledged";

export interface Occurrence {
  id: UUID;
  actionId: UUID;
  date: ISODate;
  time: HHMM | null;
  status: OccurrenceStatus;
  resolution: Resolution | null;
  completedAt: Timestamp | null;
  source: OccurrenceSource;
  rescheduledFromId: UUID | null;
  rescheduledToId: UUID | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const HISTORY_EVENT_TYPES = [
  "created",
  "edited",
  "completed",
  "completed_late",
  "reopened",
  "missed",
  "skipped",
  "rescheduled",
  "cancelled",
  "acknowledged",
  "reason_recorded",
  "recovery_plan_created",
  "recovery_plan_completed",
  "admin_annotation",
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export interface HistoryEvent {
  id: UUID;
  actionId: UUID;
  occurrenceId: UUID | null;
  type: HistoryEventType;
  at: Timestamp;
  data: Record<string, unknown>;
}

export const REASON_CODES = [
  "forgot",
  "no_time",
  "low_energy",
  "unexpected_event",
  "unclear_next_step",
  "blocked",
  "changed_priorities",
  "unwell",
  "other",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export type AccountabilityTrigger = "missed" | "skipped";

export interface AccountabilityResponse {
  id: UUID;
  actionId: UUID;
  occurrenceId: UUID;
  trigger: AccountabilityTrigger;
  reasonCode: ReasonCode;
  note: string | null;
  outcome: Resolution;
  createdAt: Timestamp;
}

export interface RecoveryStep {
  id: UUID;
  text: string;
  done: boolean;
}

export type RecoveryStatus = "active" | "completed" | "abandoned";
export interface RecoveryPlan {
  id: UUID;
  actionId: UUID;
  occurrenceId: UUID;
  responseId: UUID | null;
  title: string;
  steps: RecoveryStep[];
  restartDate: ISODate | null;
  status: RecoveryStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GoalKind = "goal" | "project";
export type GoalStatus = "active" | "paused" | "completed" | "archived";
export interface Goal {
  id: UUID;
  title: string;
  description: string | null;
  kind: GoalKind;
  categoryId: UUID | null;
  targetDate: ISODate | null;
  status: GoalStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MilestoneStatus = "todo" | "done";
export interface Milestone {
  id: UUID;
  goalId: UUID;
  title: string;
  targetDate: ISODate | null;
  position: number;
  status: MilestoneStatus;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const REMINDER_STYLES = ["gentle", "standard", "firm", "persistent"] as const;
export type ReminderStyle = (typeof REMINDER_STYLES)[number];

export interface Preferences {
  /** How Dogdzi addresses the user, e.g. on Today. */
  firstName: string | null;
  lifeAreas: LifeArea[];
  timezone: string;
  weekStartsOn: 0 | 1;
  onboardingCompleted: boolean;
  reminderStyle: ReminderStyle;
  quietStart: HHMM;
  quietEnd: HHMM;
  maxNotificationsPerDay: number;
  pushEnabled: boolean;
  /** Version of the Terms of Service accepted, and when. */
  termsVersion: string | null;
  termsAcceptedAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface Snapshot {
  categories: Category[];
  actions: Action[];
  occurrences: Occurrence[];
  events: HistoryEvent[];
  responses: AccountabilityResponse[];
  recoveryPlans: RecoveryPlan[];
  goals: Goal[];
  milestones: Milestone[];
  preferences: Preferences;
}

/** Tables whose rows may be inserted or updated (never deleted). */
export type MutableTable = "categories" | "actions" | "occurrences" | "recoveryPlans" | "goals" | "milestones";
/** Tables that are insert-only. */
export type AppendOnlyTable = "events" | "responses";

export interface Patch {
  upsert: {
    categories?: Category[];
    actions?: Action[];
    occurrences?: Occurrence[];
    recoveryPlans?: RecoveryPlan[];
    goals?: Goal[];
    milestones?: Milestone[];
  };
  append: {
    events?: HistoryEvent[];
    responses?: AccountabilityResponse[];
  };
  preferences?: Partial<Preferences>;
}

export type DataMode = "guest" | "account";

/** Injected clock and id source so domain functions stay pure and testable. */
export interface Ctx {
  now: Date;
  id: () => UUID;
  timezone: string;
}
