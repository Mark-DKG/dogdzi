import { test } from "node:test";
import assert from "node:assert/strict";
import { createAction, createGoal, markMissed, respond } from "../src/lib/domain/actions";
import { checkCapability, GUEST_LIMITS } from "../src/lib/domain/limits";
import { applyPatch, missingAreaCategories } from "../src/lib/domain/snapshot";
import { hasGuestData, LocalRepo, MemoryKV, readGuestSnapshot, GUEST_KEY, GUEST_IMPORTED_PREFIX } from "../src/lib/store/local-repo";
import { planGuestMigration } from "../src/lib/store/migrate-guest";
import { makeCtx, run, snap } from "./helpers";

function guestWithData() {
  const ctx = makeCtx("2026-11-01T08:00:00Z");
  let s = snap();
  s = applyPatch(s, { upsert: { categories: missingAreaCategories(s, ["work", "health"], ctx.now.toISOString(), ctx.id) }, append: {}, preferences: { onboardingCompleted: true, reminderStyle: "firm" } });
  const work = s.categories.find((c) => c.area === "work")!;
  s = run(
    s,
    (x) => createAction(x, { title: "Draft proposal", startDate: "2026-11-01", time: "09:00", categoryId: work.id }, ctx),
    (x) => createGoal(x, { title: "Ship v1", milestones: [{ title: "Beta" }] }, ctx),
  );
  ctx.set("2026-11-02T08:00:00Z");
  s = applyPatch(s, markMissed(s, ctx));
  s = run(s, (x) => respond(x, x.occurrences[0].id, { trigger: "missed", reasonCode: "no_time", note: null, outcome: "reschedule", reschedule: { date: "2026-11-03", time: null } }, ctx));
  return { s, work };
}

test("guest data round-trips through local storage", async () => {
  const kv = new MemoryKV();
  const repo = new LocalRepo(kv, "Africa/Accra", () => new Date("2026-11-02T08:00:00Z"));
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  const p = createAction(await repo.load(), { title: "Read", startDate: "2026-11-02" }, ctx);
  await repo.commit(p);
  const back = readGuestSnapshot(kv)!;
  assert.equal(back.actions[0].title, "Read");
  assert.ok(hasGuestData(back));
  const page = await repo.listHistory({});
  assert.equal(page.events.length, 1);
});

test("migration moves every guest record, keeping ids, history and responses", () => {
  const { s: guest } = guestWithData();
  const account = snap();
  const plan = planGuestMigration(guest, account);
  assert.equal(plan.patch.upsert.actions?.length, guest.actions.length);
  assert.equal(plan.patch.upsert.occurrences?.length, guest.occurrences.length);
  assert.equal(plan.patch.append.events?.length, guest.events.length);
  assert.equal(plan.patch.append.responses?.length, 1);
  assert.equal(plan.patch.upsert.goals?.length, 1);
  assert.equal(plan.patch.upsert.milestones?.length, 1);
  const merged = applyPatch(account, plan.patch);
  assert.deepEqual(merged.occurrences.map((o) => o.status).sort(), ["missed", "pending"], "the missed original survives conversion");
  assert.equal(merged.preferences.reminderStyle, "firm", "a fresh account adopts guest settings");
  assert.equal(merged.preferences.pushEnabled, false, "push is never carried over");
});

test("migration merges matching categories instead of duplicating them", () => {
  const { s: guest, work } = guestWithData();
  const ctx = makeCtx("2026-10-01T08:00:00Z");
  let account = snap();
  account = applyPatch(account, { upsert: { categories: missingAreaCategories(account, ["work"], ctx.now.toISOString(), ctx.id).map((c) => ({ ...c, id: "aaaaaaaa-0000-4000-8000-000000000001" })) }, append: {}, preferences: { onboardingCompleted: true, reminderStyle: "gentle" } });
  const plan = planGuestMigration(guest, account);
  assert.equal(plan.categoryMap[work.id], "aaaaaaaa-0000-4000-8000-000000000001");
  assert.equal(plan.patch.upsert.categories?.length, 1, "only Health is new");
  assert.ok(plan.patch.upsert.actions!.every((a) => a.categoryId === "aaaaaaaa-0000-4000-8000-000000000001"));
  assert.equal(plan.patch.preferences, undefined, "an already set-up account keeps its own settings");
});

test("after import the guest store is archived on the device, not silently dropped", () => {
  const kv = new MemoryKV();
  kv.setItem(GUEST_KEY, JSON.stringify(guestWithData().s));
  new LocalRepo(kv, "UTC").archiveAfterImport("2026-11-02");
  assert.equal(kv.getItem(GUEST_KEY), null);
  assert.ok(kv.getItem(GUEST_IMPORTED_PREFIX + "2026-11-02"));
});

test("guest limits apply only to guests", () => {
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let s = snap();
  for (let i = 0; i < GUEST_LIMITS.maxActiveActions; i++) s = run(s, (x) => createAction(x, { title: `A${i}`, startDate: "2026-11-02" }, ctx));
  assert.equal(checkCapability("guest", s, "create_action").ok, false);
  assert.equal(checkCapability("account", s, "create_action").ok, true);
  assert.equal(checkCapability("guest", s, "recurrence").ok, false);
  assert.equal(checkCapability("guest", s, "recovery_plan").ok, false);
  s = run(s, (x) => createGoal(x, { title: "G", milestones: [{ title: "1" }, { title: "2" }, { title: "3" }] }, ctx));
  assert.equal(checkCapability("guest", s, "create_goal").ok, false);
  assert.equal(checkCapability("guest", s, "add_milestone", { goalId: s.goals[0].id }).ok, false);
});

test("terms acceptance is recorded and carried into a new account", async () => {
  const { updatePreferences } = await import("../src/lib/domain/actions");
  const { TERMS_VERSION, hasAcceptedCurrentTerms } = await import("../src/lib/legal/terms");
  const ctx = makeCtx("2026-11-02T08:00:00Z");
  let guest = snap();
  assert.equal(hasAcceptedCurrentTerms(guest.preferences.termsVersion), false, "new users must accept");
  guest = run(guest, (x) => updatePreferences(x, { termsVersion: TERMS_VERSION, termsAcceptedAt: ctx.now.toISOString() }, ctx));
  guest = run(guest, (x) => createAction(x, { title: "Plan week", startDate: "2026-11-02" }, ctx));
  const account = applyPatch(snap(), { upsert: {}, append: {}, preferences: { onboardingCompleted: true } });
  const merged = applyPatch(account, planGuestMigration(guest, account).patch);
  assert.ok(hasAcceptedCurrentTerms(merged.preferences.termsVersion));
  assert.equal(merged.preferences.termsAcceptedAt, "2026-11-02T08:00:00.000Z");
  assert.equal(hasAcceptedCurrentTerms("2020-01-01"), false, "an old version must be re-accepted");
});
