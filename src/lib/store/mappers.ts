/**
 * Row ⇄ model mapping for Supabase. Column names match
 * supabase/migrations/0001_init.sql.
 */
import type {
  AccountabilityResponse,
  Action,
  Category,
  Goal,
  HistoryEvent,
  Milestone,
  Occurrence,
  Preferences,
  RecoveryPlan,
} from "@/lib/domain/types";

type Row = Record<string, unknown>;
const hhmm = (t: unknown) => (typeof t === "string" && t ? t.slice(0, 5) : null);
const str = (v: unknown) => (v == null ? null : String(v));

export const TABLES = {
  categories: "categories",
  goals: "goals",
  milestones: "milestones",
  actions: "actions",
  occurrences: "occurrences",
  recoveryPlans: "recovery_plans",
  events: "action_history",
  responses: "accountability_responses",
} as const;

export const toRow = {
  categories: (c: Category, user_id: string): Row => ({
    id: c.id, user_id, name: c.name, area: c.area, color: c.color, position: c.position, archived: c.archived,
    created_at: c.createdAt, updated_at: c.updatedAt,
  }),
  goals: (g: Goal, user_id: string): Row => ({
    id: g.id, user_id, title: g.title, description: g.description, kind: g.kind, category_id: g.categoryId,
    target_date: g.targetDate, status: g.status, created_at: g.createdAt, updated_at: g.updatedAt,
  }),
  milestones: (m: Milestone, user_id: string): Row => ({
    id: m.id, user_id, goal_id: m.goalId, title: m.title, target_date: m.targetDate, position: m.position,
    status: m.status, completed_at: m.completedAt, created_at: m.createdAt, updated_at: m.updatedAt,
  }),
  actions: (a: Action, user_id: string): Row => ({
    id: a.id, user_id, title: a.title, notes: a.notes, category_id: a.categoryId, kind: a.kind, priority: a.priority,
    start_date: a.startDate, due_time: a.time, duration_min: a.durationMin, recurrence: a.recurrence,
    reminder_offsets: a.reminderOffsets, reminders_enabled: a.remindersEnabled, goal_id: a.goalId,
    milestone_id: a.milestoneId, status: a.status, created_at: a.createdAt, updated_at: a.updatedAt,
  }),
  occurrences: (o: Occurrence, user_id: string): Row => ({
    id: o.id, user_id, action_id: o.actionId, scheduled_date: o.date, scheduled_time: o.time, status: o.status,
    resolution: o.resolution, completed_at: o.completedAt, source: o.source, rescheduled_from_id: o.rescheduledFromId,
    rescheduled_to_id: o.rescheduledToId, created_at: o.createdAt, updated_at: o.updatedAt,
  }),
  recoveryPlans: (p: RecoveryPlan, user_id: string): Row => ({
    id: p.id, user_id, action_id: p.actionId, occurrence_id: p.occurrenceId, response_id: p.responseId, title: p.title,
    steps: p.steps, restart_date: p.restartDate, status: p.status, created_at: p.createdAt, updated_at: p.updatedAt,
  }),
  events: (e: HistoryEvent, user_id: string): Row => ({
    id: e.id, user_id, action_id: e.actionId, occurrence_id: e.occurrenceId, event_type: e.type, data: e.data, created_at: e.at,
  }),
  responses: (r: AccountabilityResponse, user_id: string): Row => ({
    id: r.id, user_id, action_id: r.actionId, occurrence_id: r.occurrenceId, trigger: r.trigger, reason_code: r.reasonCode,
    note: r.note, outcome: r.outcome, created_at: r.createdAt,
  }),
};

export const fromRow = {
  categories: (r: Row): Category => ({
    id: String(r.id), name: String(r.name), area: r.area as Category["area"], color: String(r.color), position: Number(r.position),
    archived: !!r.archived, createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  goals: (r: Row): Goal => ({
    id: String(r.id), title: String(r.title), description: str(r.description), kind: r.kind as Goal["kind"],
    categoryId: str(r.category_id), targetDate: str(r.target_date), status: r.status as Goal["status"],
    createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  milestones: (r: Row): Milestone => ({
    id: String(r.id), goalId: String(r.goal_id), title: String(r.title), targetDate: str(r.target_date), position: Number(r.position),
    status: r.status as Milestone["status"], completedAt: str(r.completed_at), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  actions: (r: Row): Action => ({
    id: String(r.id), title: String(r.title), notes: str(r.notes), categoryId: str(r.category_id), kind: r.kind as Action["kind"],
    priority: r.priority as Action["priority"], startDate: String(r.start_date), time: hhmm(r.due_time),
    durationMin: r.duration_min == null ? null : Number(r.duration_min), recurrence: (r.recurrence as Action["recurrence"]) ?? null,
    reminderOffsets: Array.isArray(r.reminder_offsets) ? (r.reminder_offsets as number[]).map(Number) : [],
    remindersEnabled: r.reminders_enabled !== false, goalId: str(r.goal_id), milestoneId: str(r.milestone_id),
    status: r.status as Action["status"], createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  occurrences: (r: Row): Occurrence => ({
    id: String(r.id), actionId: String(r.action_id), date: String(r.scheduled_date), time: hhmm(r.scheduled_time),
    status: r.status as Occurrence["status"], resolution: (r.resolution as Occurrence["resolution"]) ?? null,
    completedAt: str(r.completed_at), source: r.source as Occurrence["source"], rescheduledFromId: str(r.rescheduled_from_id),
    rescheduledToId: str(r.rescheduled_to_id), createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  recoveryPlans: (r: Row): RecoveryPlan => ({
    id: String(r.id), actionId: String(r.action_id), occurrenceId: String(r.occurrence_id), responseId: str(r.response_id),
    title: String(r.title), steps: (r.steps as RecoveryPlan["steps"]) ?? [], restartDate: str(r.restart_date),
    status: r.status as RecoveryPlan["status"], createdAt: String(r.created_at), updatedAt: String(r.updated_at),
  }),
  events: (r: Row): HistoryEvent => ({
    id: String(r.id), actionId: String(r.action_id), occurrenceId: str(r.occurrence_id), type: r.event_type as HistoryEvent["type"],
    at: String(r.created_at), data: (r.data as Record<string, unknown>) ?? {},
  }),
  responses: (r: Row): AccountabilityResponse => ({
    id: String(r.id), actionId: String(r.action_id), occurrenceId: String(r.occurrence_id), trigger: r.trigger as AccountabilityResponse["trigger"],
    reasonCode: r.reason_code as AccountabilityResponse["reasonCode"], note: str(r.note), outcome: r.outcome as AccountabilityResponse["outcome"],
    createdAt: String(r.created_at),
  }),
};

export function prefsToRows(p: Partial<Preferences>, user_id: string) {
  const user: Row = { user_id };
  const notif: Row = { user_id };
  if (p.lifeAreas) user.life_areas = p.lifeAreas;
  if (p.timezone) user.timezone = p.timezone;
  if (p.weekStartsOn !== undefined) user.week_starts_on = p.weekStartsOn;
  if (p.onboardingCompleted !== undefined) user.onboarding_completed = p.onboardingCompleted;
  if (p.termsVersion !== undefined) user.terms_version = p.termsVersion;
  if (p.termsAcceptedAt !== undefined) user.terms_accepted_at = p.termsAcceptedAt;
  if (p.reminderStyle) notif.reminder_style = p.reminderStyle;
  if (p.quietStart) notif.quiet_start = p.quietStart;
  if (p.quietEnd) notif.quiet_end = p.quietEnd;
  if (p.maxNotificationsPerDay !== undefined) notif.max_per_day = p.maxNotificationsPerDay;
  if (p.pushEnabled !== undefined) notif.push_enabled = p.pushEnabled;
  if (p.updatedAt) {
    user.updated_at = p.updatedAt;
    notif.updated_at = p.updatedAt;
  }
  return { user: Object.keys(user).length > 1 ? user : null, notif: Object.keys(notif).length > 1 ? notif : null };
}

export function prefsFromRows(user: Row | null, notif: Row | null, fallback: Preferences): Preferences {
  return {
    lifeAreas: (user?.life_areas as Preferences["lifeAreas"]) ?? fallback.lifeAreas,
    timezone: (user?.timezone as string) ?? fallback.timezone,
    weekStartsOn: (user?.week_starts_on as 0 | 1) ?? fallback.weekStartsOn,
    onboardingCompleted: (user?.onboarding_completed as boolean) ?? fallback.onboardingCompleted,
    reminderStyle: (notif?.reminder_style as Preferences["reminderStyle"]) ?? fallback.reminderStyle,
    quietStart: hhmm(notif?.quiet_start) ?? fallback.quietStart,
    quietEnd: hhmm(notif?.quiet_end) ?? fallback.quietEnd,
    maxNotificationsPerDay: notif?.max_per_day != null ? Number(notif.max_per_day) : fallback.maxNotificationsPerDay,
    pushEnabled: (notif?.push_enabled as boolean) ?? fallback.pushEnabled,
    termsVersion: (user?.terms_version as string | null) ?? fallback.termsVersion,
    termsAcceptedAt: (user?.terms_accepted_at as string | null) ?? fallback.termsAcceptedAt,
    updatedAt: String(user?.updated_at ?? fallback.updatedAt),
  };
}
