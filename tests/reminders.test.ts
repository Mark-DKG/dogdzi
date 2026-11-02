import { test } from "node:test";
import assert from "node:assert/strict";
import { createAction } from "../src/lib/domain/actions";
import { applyDailyCap, deferForQuietHours, planReminders } from "../src/lib/domain/reminders";
import { expandRecurrence } from "../src/lib/domain/recurrence";
import { isInQuietHours } from "../src/lib/domain/dates";
import { selectReminders } from "../src/lib/push/dispatch";
import type { Preferences } from "../src/lib/domain/types";
import { makeCtx, run, snap } from "./helpers";

const prefs = (over: Partial<Preferences> = {}): Preferences => ({ ...snap().preferences, timezone: "Africa/Accra", ...over });

function oneAction(time: string | null, offsets: number[] = []) {
  const ctx = makeCtx("2026-11-02T06:00:00Z");
  const s = run(snap(), (x) => createAction(x, { title: "Pay bills", startDate: "2026-11-02", time, reminderOffsets: offsets }, ctx));
  return { o: s.occurrences[0], a: s.actions[0] };
}

test("reminder styles escalate from gentle to persistent", () => {
  const { o, a } = oneAction("14:00");
  const counts = (["gentle", "standard", "firm", "persistent"] as const).map((style) => planReminders(o, a, prefs({ reminderStyle: style })).length);
  assert.deepEqual(counts, [1, 2, 3, 6]);
  const gentle = planReminders(o, a, prefs({ reminderStyle: "gentle" }));
  assert.equal(gentle[0].at.toISOString(), "2026-11-02T14:00:00.000Z");
  assert.match(gentle[0].body, /When you're ready/);
});

test("custom offsets replace style defaults; gentle keeps only one", () => {
  const { o, a } = oneAction("14:00", [60, 10]);
  const std = planReminders(o, a, prefs({ reminderStyle: "standard" })).map((r) => r.at.toISOString().slice(11, 16));
  assert.deepEqual(std, ["13:00", "13:50", "14:00"]);
  const gentle = planReminders(o, a, prefs({ reminderStyle: "gentle" }));
  assert.equal(gentle.length, 1);
  assert.equal(gentle[0].at.toISOString().slice(11, 16), "13:50");
});

test("quiet hours defer reminders to the end of the quiet window", () => {
  assert.ok(isInQuietHours("23:30", "22:00", "07:00"));
  assert.ok(isInQuietHours("06:59", "22:00", "07:00"));
  assert.ok(!isInQuietHours("07:00", "22:00", "07:00"));
  const p = prefs({ quietStart: "22:00", quietEnd: "07:00" });
  assert.equal(deferForQuietHours(new Date("2026-11-02T05:00:00Z"), p)?.toISOString(), "2026-11-02T07:00:00.000Z");
  assert.equal(deferForQuietHours(new Date("2026-11-02T23:00:00Z"), p)?.toISOString(), "2026-11-03T07:00:00.000Z");
  // An action at 06:30 with a 07:00 quiet end still gets a (deferred) reminder before it counts as missed.
  const { o, a } = oneAction("06:30");
  const plans = planReminders(o, a, p);
  assert.ok(plans.every((r) => r.at.toISOString() >= "2026-11-02T07:00:00.000Z"));
  assert.ok(plans.length >= 1);
});

test("nothing is planned for done actions or when reminders are off", () => {
  const { o, a } = oneAction("14:00");
  assert.equal(planReminders({ ...o, status: "done" }, a, prefs()).length, 0);
  assert.equal(planReminders(o, { ...a, remindersEnabled: false }, prefs()).length, 0);
});

test("daily cap keeps on-time reminders first", () => {
  const { o, a } = oneAction("14:00");
  const all = planReminders(o, a, prefs({ reminderStyle: "persistent" }));
  const capped = applyDailyCap(all, 10, 12);
  assert.equal(capped.length, 2);
  assert.equal(capped[0].kind, "due");
  assert.equal(applyDailyCap(all, 12, 12).length, 0);
});

test("server dispatch skips already-sent keys and respects push opt-in", () => {
  const { o, a } = oneAction("14:00");
  const base = {
    now: new Date("2026-11-02T14:05:00Z"),
    windowStart: new Date("2026-11-02T13:50:00Z"),
    prefs: prefs({ pushEnabled: true }),
    actions: [a],
    occurrences: [o],
    alreadySent: new Set<string>(),
    sentToday: 0,
  };
  const first = selectReminders(base);
  assert.deepEqual(first.map((r) => r.kind), ["due"]);
  assert.equal(selectReminders({ ...base, alreadySent: new Set(first.map((r) => r.key)) }).length, 0);
  assert.equal(selectReminders({ ...base, prefs: prefs({ pushEnabled: false }) }).length, 0);
});

test("recurrence expansion: daily intervals, weekdays, monthly clamping, until", () => {
  assert.deepEqual(expandRecurrence({ freq: "daily", interval: 2 }, "2026-11-01", "2026-11-02", "2026-11-08"), ["2026-11-03", "2026-11-05", "2026-11-07"]);
  assert.deepEqual(
    expandRecurrence({ freq: "weekly", interval: 1, byWeekday: [1, 3] }, "2026-11-02", "2026-11-02", "2026-11-11"),
    ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"],
  );
  assert.deepEqual(expandRecurrence({ freq: "weekly", interval: 2, byWeekday: [1] }, "2026-11-02", "2026-11-02", "2026-11-30"), ["2026-11-02", "2026-11-16", "2026-11-30"]);
  assert.deepEqual(expandRecurrence({ freq: "monthly", interval: 1 }, "2026-01-31", "2026-01-01", "2026-04-30"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.deepEqual(expandRecurrence({ freq: "daily", interval: 1, until: "2026-11-03" }, "2026-11-01", "2026-11-01", "2026-11-10"), ["2026-11-01", "2026-11-02", "2026-11-03"]);
});
