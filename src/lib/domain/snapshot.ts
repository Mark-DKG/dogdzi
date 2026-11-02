import { uuid } from "./ids";
import type { Category, LifeArea, Patch, Preferences, Snapshot } from "./types";

export const AREA_META: Record<LifeArea, { label: string; color: string }> = {
  personal: { label: "Personal", color: "#6A977D" },
  work: { label: "Work", color: "#3B654F" },
  education: { label: "Education", color: "#7C8F4E" },
  health: { label: "Health", color: "#4E8A7A" },
  home: { label: "Home", color: "#9A7B4F" },
  finance: { label: "Finance", color: "#5E7B3A" },
  social: { label: "Social", color: "#A0674B" },
  custom: { label: "Custom", color: "#7A7466" },
};

export const DEFAULT_AREAS: LifeArea[] = ["personal", "work", "health", "home"];

export function defaultPreferences(timezone: string, nowIso: string): Preferences {
  return {
    lifeAreas: DEFAULT_AREAS,
    timezone,
    weekStartsOn: 1,
    onboardingCompleted: false,
    reminderStyle: "standard",
    quietStart: "22:00",
    quietEnd: "07:00",
    maxNotificationsPerDay: 12,
    pushEnabled: false,
    termsVersion: null,
    termsAcceptedAt: null,
    updatedAt: nowIso,
  };
}

export function emptySnapshot(timezone: string, nowIso: string): Snapshot {
  return {
    categories: [],
    actions: [],
    occurrences: [],
    events: [],
    responses: [],
    recoveryPlans: [],
    goals: [],
    milestones: [],
    preferences: defaultPreferences(timezone, nowIso),
  };
}

/** Categories for the chosen life areas that the snapshot doesn't have yet. */
export function missingAreaCategories(s: Snapshot, areas: LifeArea[], nowIso: string, id: () => string = uuid): Category[] {
  const have = new Set(s.categories.filter((c) => c.area !== "custom").map((c) => c.area));
  let pos = s.categories.length;
  return areas
    .filter((a) => a !== "custom" && !have.has(a))
    .map((area) => ({
      id: id(),
      name: AREA_META[area].label,
      area,
      color: AREA_META[area].color,
      position: pos++,
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
}

type Keyed = { id: string };
function upsertList<T extends Keyed>(list: T[], rows: T[] | undefined): T[] {
  if (!rows || rows.length === 0) return list;
  const map = new Map(list.map((r) => [r.id, r]));
  for (const r of rows) map.set(r.id, r);
  return Array.from(map.values());
}
function appendList<T extends Keyed>(list: T[], rows: T[] | undefined): T[] {
  if (!rows || rows.length === 0) return list;
  const seen = new Set(list.map((r) => r.id));
  return list.concat(rows.filter((r) => !seen.has(r.id)));
}

export function applyPatch(s: Snapshot, p: Patch): Snapshot {
  return {
    categories: upsertList(s.categories, p.upsert.categories),
    actions: upsertList(s.actions, p.upsert.actions),
    occurrences: upsertList(s.occurrences, p.upsert.occurrences),
    recoveryPlans: upsertList(s.recoveryPlans, p.upsert.recoveryPlans),
    goals: upsertList(s.goals, p.upsert.goals),
    milestones: upsertList(s.milestones, p.upsert.milestones),
    events: appendList(s.events, p.append.events),
    responses: appendList(s.responses, p.append.responses),
    preferences: p.preferences ? { ...s.preferences, ...p.preferences } : s.preferences,
  };
}

export function emptyPatch(): Patch {
  return { upsert: {}, append: {} };
}

export function mergePatches(...patches: Patch[]): Patch {
  const out = emptyPatch();
  for (const p of patches) {
    for (const [k, rows] of Object.entries(p.upsert) as [keyof Patch["upsert"], Keyed[]][]) {
      const existing = (out.upsert[k] ?? []) as Keyed[];
      const map = new Map(existing.map((r) => [r.id, r]));
      for (const r of rows ?? []) map.set(r.id, r);
      (out.upsert as Record<string, Keyed[]>)[k] = Array.from(map.values());
    }
    for (const [k, rows] of Object.entries(p.append) as [keyof Patch["append"], Keyed[]][]) {
      (out.append as Record<string, Keyed[]>)[k] = ((out.append[k] ?? []) as Keyed[]).concat(rows ?? []);
    }
    if (p.preferences) out.preferences = { ...(out.preferences ?? {}), ...p.preferences };
  }
  return out;
}

export function isPatchEmpty(p: Patch): boolean {
  const any = (o: Record<string, unknown[] | undefined>) => Object.values(o).some((v) => v && v.length > 0);
  return !any(p.upsert) && !any(p.append) && !p.preferences;
}
