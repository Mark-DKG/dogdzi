/**
 * Guest → account conversion. Guest records already use UUIDs, so they can
 * be inserted as-is. The only remapping needed is categories: if the account
 * already has "Work", the guest's "Work" merges into it instead of creating
 * a duplicate.
 */
import type { Category, Patch, Preferences, Snapshot, UUID } from "@/lib/domain/types";

export interface MigrationPlan {
  patch: Patch;
  categoryMap: Record<UUID, UUID>;
  counts: { actions: number; occurrences: number; goals: number; history: number; responses: number; recoveryPlans: number };
}

const catKey = (c: Pick<Category, "area" | "name">) => `${c.area}:${c.name.trim().toLowerCase()}`;

export function planGuestMigration(guest: Snapshot, account: Snapshot): MigrationPlan {
  const existing = new Map(account.categories.map((c) => [catKey(c), c.id]));
  const accountIds = new Set(account.categories.map((c) => c.id));
  const categoryMap: Record<UUID, UUID> = {};
  const newCategories: Category[] = [];
  let pos = account.categories.length;
  for (const c of guest.categories) {
    const match = existing.get(catKey(c));
    if (match) categoryMap[c.id] = match;
    else if (accountIds.has(c.id)) categoryMap[c.id] = c.id;
    else {
      categoryMap[c.id] = c.id;
      newCategories.push({ ...c, position: pos++ });
      existing.set(catKey(c), c.id);
    }
  }
  const mapCat = (id: UUID | null) => (id ? (categoryMap[id] ?? null) : null);

  const patch: Patch = {
    upsert: {
      categories: newCategories,
      goals: guest.goals.map((g) => ({ ...g, categoryId: mapCat(g.categoryId) })),
      milestones: guest.milestones,
      actions: guest.actions.map((a) => ({ ...a, categoryId: mapCat(a.categoryId) })),
      occurrences: guest.occurrences,
      recoveryPlans: guest.recoveryPlans,
    },
    append: { events: guest.events, responses: guest.responses },
  };

  // Keep the account's own settings if it was already set up; otherwise adopt the guest's.
  if (!account.preferences.onboardingCompleted && guest.preferences.onboardingCompleted) {
    const { pushEnabled: _push, ...rest } = guest.preferences;
    void _push;
    patch.preferences = rest as Partial<Preferences>;
  }
  // A first name given as a guest carries over if the account has none.
  if (guest.preferences.firstName && !account.preferences.firstName) {
    patch.preferences = { ...(patch.preferences ?? {}), firstName: guest.preferences.firstName };
  }
  // Terms accepted as a guest on this device count for the new account.
  if (guest.preferences.termsVersion && !account.preferences.termsVersion) {
    patch.preferences = { ...(patch.preferences ?? {}), termsVersion: guest.preferences.termsVersion, termsAcceptedAt: guest.preferences.termsAcceptedAt };
  }

  return {
    patch,
    categoryMap,
    counts: {
      actions: guest.actions.length,
      occurrences: guest.occurrences.length,
      goals: guest.goals.length,
      history: guest.events.length,
      responses: guest.responses.length,
      recoveryPlans: guest.recoveryPlans.length,
    },
  };
}
